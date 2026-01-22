// src/services/transactionSplitService.ts
import { TransactionSplitModel, ITransactionSplit } from '../models/TransactionSplit.model';
import { Transaction } from '../types';
import crypto from 'crypto';

/**
 * Generate a unique ID for a transaction based on its properties
 */
export function generateTransactionId(transaction: Transaction): string {
    const key = `${transaction.date}_${transaction.description}_${transaction.amount}`;
    return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
}

/**
 * Save a transaction split
 */
export async function saveTransactionSplit(
    transaction: Transaction,
    splits: Array<{
        userId: string;
        userName?: string;
        amount: number;
        percentage: number;
    }>,
    createdBy?: string
): Promise<ITransactionSplit> {
    const transactionId = generateTransactionId(transaction);

    const splitData = {
        transactionId,
        originalDescription: transaction.description || '',
        originalAmount: transaction.amount || 0,
        date: new Date(transaction.date || new Date()),
        splits,
        createdBy
    };

    // Use upsert to update if exists
    const result = await TransactionSplitModel.findOneAndUpdate(
        { transactionId },
        splitData,
        { upsert: true, new: true }
    );

    return result;
}

/**
 * Get transaction splits for multiple transactions
 */
export async function getTransactionSplits(
    transactions: Transaction[]
): Promise<Map<string, ITransactionSplit>> {
    const transactionIds = transactions.map(t => generateTransactionId(t));

    const splits = await TransactionSplitModel.find({
        transactionId: { $in: transactionIds }
    });

    const splitMap = new Map<string, ITransactionSplit>();
    splits.forEach(split => {
        splitMap.set(split.transactionId, split);
    });

    return splitMap;
}

/**
 * Delete a transaction split
 */
export async function deleteTransactionSplit(transactionId: string): Promise<boolean> {
    const result = await TransactionSplitModel.deleteOne({ transactionId });
    return result.deletedCount > 0;
}

/**
 * Get all splits for a user
 */
export async function getUserTransactionSplits(userId: string): Promise<ITransactionSplit[]> {
    return TransactionSplitModel.find({
        'splits.userId': userId
    }).sort({ date: -1 });
}