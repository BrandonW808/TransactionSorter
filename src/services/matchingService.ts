import Receipt, { IReceipt, IReceiptItem, IUserSplit } from '../models/Receipt.model';
import { Transaction, TransactionWithReceipt, ReceiptMatch } from '../types';

interface MatchResult {
    receipt: IReceipt;
    confidence: number;
    matchType: 'amount' | 'date' | 'combined' | 'manual';
}

/**
 * Find receipts that potentially match a transaction
 */
export async function findMatchingReceipts(
    transaction: Transaction,
    userId?: string,
    toleranceAmount: number = 0.01,
    toleranceDays: number = 1
): Promise<MatchResult[]> {
    const transactionAmount = Math.abs(transaction.amount);
    const transactionDate = new Date(transaction.date);

    // Create date range for matching
    const startDate = new Date(transactionDate);
    startDate.setDate(startDate.getDate() - toleranceDays);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(transactionDate);
    endDate.setDate(endDate.getDate() + toleranceDays);
    endDate.setHours(23, 59, 59, 999);

    // Build query
    const query: any = {
        date: { $gte: startDate, $lte: endDate }
    };

    // If userId provided, filter to receipts involving that user
    if (userId) {
        query.$or = [
            { userId: userId },
            { userIds: userId },
            { 'items.userSplits.userId': userId }
        ];
    }

    const receipts = await Receipt.find(query).sort({ date: -1 });
    const matches: MatchResult[] = [];

    for (const receipt of receipts) {
        let confidence = 0;
        let matchType: 'amount' | 'date' | 'combined' = 'date';

        // Check amount match
        const amountDiff = Math.abs(receipt.total - transactionAmount);
        if (amountDiff <= toleranceAmount) {
            confidence += 0.5;
            matchType = 'amount';
        } else if (amountDiff <= transactionAmount * 0.05) {
            // Within 5% tolerance
            confidence += 0.3;
        }

        // Check date match (same day = higher confidence)
        const receiptDate = new Date(receipt.date);
        const daysDiff = Math.abs(
            Math.floor((transactionDate.getTime() - receiptDate.getTime()) / (1000 * 60 * 60 * 24))
        );

        if (daysDiff === 0) {
            confidence += 0.4;
            if (matchType === 'amount') matchType = 'combined';
        } else if (daysDiff === 1) {
            confidence += 0.2;
        }

        // Check store name in description (if available)
        if (receipt.store && transaction.description) {
            const storeLower = receipt.store.toLowerCase();
            const descLower = transaction.description.toLowerCase();
            const subDescLower = (transaction.subDescription || '').toLowerCase();

            if (descLower.includes(storeLower) || subDescLower.includes(storeLower)) {
                confidence += 0.2;
            }
        }

        // Only include if confidence is above threshold
        if (confidence >= 0.3) {
            matches.push({
                receipt,
                confidence: Math.min(confidence, 1),
                matchType
            });
        }
    }

    // Sort by confidence (highest first)
    matches.sort((a, b) => b.confidence - a.confidence);

    return matches;
}

/**
 * Get the best matching receipt for a transaction
 */
export async function getBestMatch(
    transaction: Transaction,
    userId?: string
): Promise<MatchResult | null> {
    const matches = await findMatchingReceipts(transaction, userId);
    return matches.length > 0 ? matches[0] : null;
}

/**
 * Match multiple transactions to receipts
 */
export async function matchTransactionsToReceipts(
    transactions: Transaction[],
    userId: string
): Promise<{
    transactions: TransactionWithReceipt[];
    matches: Map<number, MatchResult>;
    stats: { matched: number; unmatched: number };
}> {
    const matchedTransactions: TransactionWithReceipt[] = [];
    const matches = new Map<number, MatchResult>();
    const usedReceiptIds = new Set<string>();
    let matchedCount = 0;

    for (let i = 0; i < transactions.length; i++) {
        const transaction = transactions[i];
        const potentialMatches = await findMatchingReceipts(transaction, userId);

        // Find the best match that hasn't been used yet
        const bestMatch = potentialMatches.find(m => !usedReceiptIds.has(m.receipt.id.toString()));

        if (bestMatch && bestMatch.confidence >= 0.5) {
            usedReceiptIds.add(bestMatch.receipt.id.toString());
            matches.set(i, bestMatch);
            matchedCount++;

            // Calculate user's adjusted amount
            const userAmount = calculateUserAmount(bestMatch.receipt, userId);

            matchedTransactions.push({
                ...transaction,
                matchedReceipt: {
                    receiptId: bestMatch.receipt.id.toString(),
                    matchType: bestMatch.matchType,
                    confidence: bestMatch.confidence,
                    receipt: {
                        _id: bestMatch.receipt.id.toString(),
                        total: bestMatch.receipt.total,
                        date: bestMatch.receipt.date,
                        store: bestMatch.receipt.store,
                        items: bestMatch.receipt.items,
                        userSplits: getUserSplitsFromReceipt(bestMatch.receipt, userId)
                    }
                },
                adjustedAmount: userAmount !== null ? -Math.abs(userAmount) : transaction.amount,
                originalAmount: transaction.amount
            });
        } else {
            matchedTransactions.push({
                ...transaction,
                originalAmount: transaction.amount
            });
        }
    }

    return {
        transactions: matchedTransactions,
        matches,
        stats: {
            matched: matchedCount,
            unmatched: transactions.length - matchedCount
        }
    };
}

/**
 * Calculate the user's portion from a receipt
 */
export function calculateUserAmount(receipt: IReceipt, userId: string): number | null {
    let userTotal = 0;
    let hasUserSplit = false;

    for (const item of receipt.items) {
        if (item.isSplit && item.userSplits && item.userSplits.length > 0) {
            const userSplit = item.userSplits.find(split => split.userId.toString() === userId);
            if (userSplit) {
                userTotal += userSplit.amount;
                hasUserSplit = true;
            }
        } else if (receipt.userId?.toString() === userId) {
            // Non-split item belongs to primary user
            userTotal += item.price;
            hasUserSplit = true;
        }
    }

    return hasUserSplit ? userTotal : null;
}

/**
 * Extract user splits from a receipt for a specific user
 */
function getUserSplitsFromReceipt(receipt: IReceipt, userId: string): IUserSplit[] {
    const splits: IUserSplit[] = [];

    for (const item of receipt.items) {
        if (item.userSplits) {
            const userSplit = item.userSplits.find(split => split.userId.toString() === userId);
            if (userSplit) {
                splits.push(userSplit);
            }
        }
    }

    return splits;
}

/**
 * Manually link a transaction to a receipt
 */
export async function manuallyMatchTransaction(
    transaction: Transaction,
    receiptId: string,
    userId: string
): Promise<TransactionWithReceipt> {
    const receipt = await Receipt.findById(receiptId);

    if (!receipt) {
        throw new Error('Receipt not found');
    }

    const userAmount = calculateUserAmount(receipt, userId);

    return {
        ...transaction,
        matchedReceipt: {
            receiptId: receipt.id,
            matchType: 'manual',
            confidence: 1,
            receipt: {
                _id: receipt.id,
                total: receipt.total,
                date: receipt.date,
                store: receipt.store,
                items: receipt.items,
                userSplits: getUserSplitsFromReceipt(receipt, userId)
            }
        },
        adjustedAmount: userAmount !== null ? -Math.abs(userAmount) : transaction.amount,
        originalAmount: transaction.amount
    };
}

/**
 * Get unmatched receipts for a user within a date range
 */
export async function getUnmatchedReceipts(
    userId: string,
    startDate: Date,
    endDate: Date,
    matchedReceiptIds: string[]
): Promise<IReceipt[]> {
    return Receipt.find({
        _id: { $nin: matchedReceiptIds },
        date: { $gte: startDate, $lte: endDate },
        $or: [
            { userId: userId },
            { userIds: userId },
            { 'items.userSplits.userId': userId }
        ]
    }).sort({ date: -1 });
}