// src/services/transactionSplitService.ts
import { TransactionSplitModel, ITransactionSplit, ISplitEntry } from '../models/TransactionSplit.model';
import { Transaction } from '../types';
import crypto from 'crypto';

export function generateTransactionId(transaction: Transaction): string {
    const key = `${transaction.date}_${transaction.description}_${transaction.amount}`;
    return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
}

export async function saveTransactionSplit(
    transaction: Transaction,
    splits: ISplitEntry[],
    splitType: 'user' | 'category' | 'combined' = 'user',
    createdBy?: string
): Promise<ITransactionSplit> {
    const transactionId = generateTransactionId(transaction);

    const splitData = {
        transactionId,
        originalDescription: transaction.description || '',
        originalAmount: transaction.amount || 0,
        date: new Date(transaction.date || new Date()),
        splitType,
        splits,
        createdBy
    };

    const result = await TransactionSplitModel.findOneAndUpdate(
        { transactionId },
        splitData,
        { upsert: true, new: true }
    );

    return result;
}

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

export async function getTransactionSplitsForUser(
    transactions: Transaction[],
    userId: string
): Promise<Map<string, { amount: number; entries: ISplitEntry[] }>> {
    const transactionIds = transactions.map(t => generateTransactionId(t));

    const splits = await TransactionSplitModel.find({
        transactionId: { $in: transactionIds },
        'splits.userId': userId
    });

    const userSplitMap = new Map<string, { amount: number; entries: ISplitEntry[] }>();

    splits.forEach(split => {
        const userEntries = split.splits.filter(s => s.userId === userId);
        const totalUserAmount = userEntries.reduce((sum, e) => sum + e.amount, 0);

        userSplitMap.set(split.transactionId, {
            amount: totalUserAmount,
            entries: userEntries
        });
    });

    return userSplitMap;
}

export async function getCategorySplitsForTransaction(
    transactionId: string
): Promise<ISplitEntry[] | null> {
    const split = await TransactionSplitModel.findOne({ transactionId });
    if (!split || (split.splitType !== 'category' && split.splitType !== 'combined')) {
        return null;
    }
    return split.splits;
}

export async function deleteTransactionSplit(transactionId: string): Promise<boolean> {
    const result = await TransactionSplitModel.deleteOne({ transactionId });
    return result.deletedCount > 0;
}

export async function getUserTransactionSplits(userId: string): Promise<ITransactionSplit[]> {
    return TransactionSplitModel.find({
        'splits.userId': userId
    }).sort({ date: -1 });
}

export async function getAllTransactionSplits(): Promise<ITransactionSplit[]> {
    return TransactionSplitModel.find().sort({ date: -1 });
}