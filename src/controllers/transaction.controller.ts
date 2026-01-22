import { Request, Response } from 'express';
import { parseTransactionCSV, parseSharedCsv } from '../parser';
import { categorizeTransactions, categorizeTransactionsWithReceipts, categorizeTransactionsWithSplits, OutputRow, processSharedTransactions } from '../transactions';
import * as categoryListService from '../services/categoryListService';
import * as matchingService from '../services/matchingService';
import * as transactionSplitService from '../services/transactionSplitService';
import { CategorizeRequest, Categories, TransactionWithReceipt } from '../types';

export const categorize = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactions, categories, sharedTransactions, categoryListId }: CategorizeRequest & { categoryListId?: string } = req.body;
    if (!transactions || !Array.isArray(transactions)) { res.status(400).json({ success: false, error: 'transactions array is required' }); return; }

    const categoriesToUse = await resolveCategories(categoryListId, categories);
    if (!categoriesToUse) { res.status(500).json({ success: false, error: 'No category list found' }); return; }

    let output = categorizeTransactions(transactions, categoriesToUse);
    if (sharedTransactions && sharedTransactions.length > 0) output = processSharedTransactions(output, sharedTransactions);
    res.json({ success: true, data: output });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to categorize', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const categorizeCsv = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (!files || !files.transactions || files.transactions.length === 0) { res.status(400).json({ success: false, error: 'No transactions CSV uploaded' }); return; }

    const transactionsCsv = files.transactions[0].buffer.toString('utf-8');
    const sharedCsv = files.shared && files.shared[0] ? files.shared[0].buffer.toString('utf-8') : null;
    const transactions = parseTransactionCSV(transactionsCsv);
    const sharedTransactions = sharedCsv ? parseSharedCsv(sharedCsv) : [];

    const categoriesToUse = await resolveCategoriesFromBody(req.body);
    if (!categoriesToUse) { res.status(500).json({ success: false, error: 'No category list found' }); return; }

    let output = categorizeTransactions(transactions, categoriesToUse);
    if (sharedTransactions.length > 0) output = processSharedTransactions(output, sharedTransactions);
    res.json({ success: true, data: output });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to process CSV', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const parseCsv = (req: Request, res: Response): void => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (!files || !files.transactions || files.transactions.length === 0) { res.status(400).json({ success: false, error: 'No transactions CSV uploaded' }); return; }

    const transactionsCsv = files.transactions[0].buffer.toString('utf-8');
    const sharedCsv = files.shared && files.shared[0] ? files.shared[0].buffer.toString('utf-8') : null;
    const transactions = parseTransactionCSV(transactionsCsv);
    const sharedTransactions = sharedCsv ? parseSharedCsv(sharedCsv) : [];

    res.json({ success: true, data: { transactions, sharedTransactions, counts: { transactions: transactions.length, shared: sharedTransactions.length } } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to parse CSV', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const exportCsv = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactions, categories, sharedTransactions, categoryListId }: CategorizeRequest & { categoryListId?: string } = req.body;
    if (!transactions || !Array.isArray(transactions)) { res.status(400).json({ success: false, error: 'transactions array is required' }); return; }

    const categoriesToUse = await resolveCategories(categoryListId, categories);
    if (!categoriesToUse) { res.status(500).json({ success: false, error: 'No category list found' }); return; }

    let output = categorizeTransactions(transactions, categoriesToUse);
    if (sharedTransactions && sharedTransactions.length > 0) output = processSharedTransactions(output, sharedTransactions);

    const csvContent = output.map(row => row.map(cell => typeof cell === "string" && cell.includes(",") ? `"${cell}"` : cell).join(",")).join("\n");
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="categorized_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to export CSV', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const matchReceipts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactions, userId } = req.body;
    if (!transactions || !Array.isArray(transactions)) { res.status(400).json({ success: false, error: 'transactions array is required' }); return; }
    if (!userId) { res.status(400).json({ success: false, error: 'User ID is required' }); return; }

    const result = await matchingService.matchTransactionsToReceipts(transactions, userId);
    res.json({
      success: true,
      data: {
        transactions: result.transactions,
        matchedCount: result.stats.matched,
        unmatchedCount: result.stats.unmatched,
        matches: Array.from(result.matches.entries()).map(([index, match]) => ({
          transactionIndex: index, receiptId: match.receipt.id, confidence: match.confidence, matchType: match.matchType
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to match receipts', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const manualMatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transaction, receiptId, userId } = req.body;
    if (!transaction || !receiptId || !userId) { res.status(400).json({ success: false, error: 'Transaction, receipt ID, and user ID are required' }); return; }
    const matchedTransaction = await matchingService.manuallyMatchTransaction(transaction, receiptId, userId);
    res.json({ success: true, data: matchedTransaction });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to manually match', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const categorizeWithReceipts = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (!files || !files.transactions || files.transactions.length === 0) { res.status(400).json({ success: false, error: 'No transactions CSV uploaded' }); return; }

    const { categoryListId, userId, matchReceipts: shouldMatchReceipts, applySplits } = req.body;
    if (shouldMatchReceipts === 'true' && !userId) { res.status(400).json({ success: false, error: 'User ID required for receipt matching' }); return; }

    const transactionsCsv = files.transactions[0].buffer.toString('utf-8');
    const sharedCsv = files.shared && files.shared[0] ? files.shared[0].buffer.toString('utf-8') : null;
    let transactions = parseTransactionCSV(transactionsCsv);
    const sharedTransactions = sharedCsv ? parseSharedCsv(sharedCsv) : [];

    const categoriesToUse = await resolveCategoriesFromBody(req.body);
    if (!categoriesToUse) { res.status(500).json({ success: false, error: 'No category list found' }); return; }

    let matchedTransactions: TransactionWithReceipt[] = transactions;
    let matchingStats = { matched: 0, unmatched: transactions.length };

    if (shouldMatchReceipts === 'true') {
      try {
        const matchResult = await matchingService.matchTransactionsToReceipts(transactions, userId);
        matchedTransactions = matchResult.transactions;
        matchingStats = matchResult.stats;
      } catch (matchError) {
        console.error('Receipt matching failed, continuing without:', matchError);
      }
    }

    let splitStats = { applied: 0, total: transactions.length };
    if (applySplits === 'true') {
      try {
        const splits = await transactionSplitService.getTransactionSplits(transactions);
        matchedTransactions = matchedTransactions.map(transaction => {
          const transactionId = transactionSplitService.generateTransactionId(transaction);
          const split = splits.get(transactionId);
          if (split) { splitStats.applied++; return { ...transaction, hasSplit: true, splits: split.splits, originalAmount: transaction.amount }; }
          return transaction;
        });
      } catch (splitError) { console.error('Split application failed:', splitError); }
    }

    let output: OutputRow[];
    if (applySplits === 'true' && splitStats.applied > 0) {
      output = categorizeTransactionsWithSplits(matchedTransactions, categoriesToUse);
    } else {
      output = categorizeTransactionsWithReceipts(matchedTransactions, categoriesToUse);
    }

    if (sharedTransactions.length > 0) output = processSharedTransactions(output, sharedTransactions);

    res.json({ success: true, data: output, matching: { enabled: shouldMatchReceipts === 'true', ...matchingStats }, splits: splitStats });
  } catch (error) {
    console.error('categorizeWithReceipts error:', error);
    res.status(500).json({ success: false, error: 'Failed to categorize with receipts', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getPotentialMatches = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transaction, userId } = req.body;
    if (!transaction) { res.status(400).json({ success: false, error: 'Transaction is required' }); return; }
    const matches = await matchingService.findMatchingReceipts(transaction, userId);
    res.json({
      success: true,
      data: matches.map(m => ({
        receiptId: m.receipt.id, confidence: m.confidence, matchType: m.matchType,
        receipt: { _id: m.receipt.id, total: m.receipt.total, date: m.receipt.date, store: m.receipt.store, itemCount: m.receipt.items.length }
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to find matches', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const splitTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transaction, splits, createdBy } = req.body;
    if (!transaction || !splits || !Array.isArray(splits)) { res.status(400).json({ success: false, error: 'Transaction and splits array required' }); return; }

    // Validate splits sum to original amount (using absolute values)
    const totalSplit = splits.reduce((sum: number, split: any) => sum + Math.abs(Number(split.amount) || 0), 0);
    const transactionAmount = Math.abs(Number(transaction.amount) || 0);

    if (transactionAmount === 0) {
      res.status(400).json({ success: false, error: 'Transaction amount cannot be zero' });
      return;
    }

    if (Math.abs(totalSplit - transactionAmount) > 0.02) {
      res.status(400).json({
        success: false,
        error: `Split amounts ($${totalSplit.toFixed(2)}) must equal transaction amount ($${transactionAmount.toFixed(2)})`
      });
      return;
    }

    const result = await transactionSplitService.saveTransactionSplit(transaction, splits, createdBy);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('splitTransaction error:', error);
    res.status(500).json({ success: false, error: 'Failed to split transaction', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getTransactionSplits = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactions } = req.body;
    if (!transactions || !Array.isArray(transactions)) { res.status(400).json({ success: false, error: 'Transactions array required' }); return; }
    const splits = await transactionSplitService.getTransactionSplits(transactions);
    const splitsArray = Array.from(splits.entries()).map(([id, split]) => ({ ...split }));
    res.json({ success: true, data: splitsArray });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get splits', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const deleteTransactionSplit = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactionId } = req.params;
    const deleted = await transactionSplitService.deleteTransactionSplit(transactionId);
    if (!deleted) { res.status(404).json({ success: false, error: 'Split not found' }); return; }
    res.json({ success: true, message: 'Split deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete split', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const categorizeWithSplits = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (!files || !files.transactions || files.transactions.length === 0) { res.status(400).json({ success: false, error: 'No transactions CSV uploaded' }); return; }

    const { applySplits } = req.body;
    const transactionsCsv = files.transactions[0].buffer.toString('utf-8');
    const sharedCsv = files.shared && files.shared[0] ? files.shared[0].buffer.toString('utf-8') : null;
    let transactions = parseTransactionCSV(transactionsCsv);
    const sharedTransactions = sharedCsv ? parseSharedCsv(sharedCsv) : [];

    const categoriesToUse = await resolveCategoriesFromBody(req.body);
    if (!categoriesToUse) { res.status(500).json({ success: false, error: 'No category list found' }); return; }

    let splitStats = { applied: 0, total: transactions.length };
    if (applySplits === 'true') {
      try {
        const splits = await transactionSplitService.getTransactionSplits(transactions);
        transactions = transactions.map(transaction => {
          const transactionId = transactionSplitService.generateTransactionId(transaction);
          const split = splits.get(transactionId);
          if (split) { splitStats.applied++; return { ...transaction, hasSplit: true, splits: split.splits, originalAmount: transaction.amount }; }
          return transaction;
        });
      } catch (splitError) { console.error('Split lookup failed:', splitError); }
    }

    let output = categorizeTransactionsWithSplits(transactions, categoriesToUse);
    if (sharedTransactions.length > 0) output = processSharedTransactions(output, sharedTransactions);
    res.json({ success: true, data: output, splits: splitStats });
  } catch (error) {
    console.error('categorizeWithSplits error:', error);
    res.status(500).json({ success: false, error: 'Failed to categorize with splits', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// --- Helper functions ---
async function resolveCategories(categoryListId?: string, categories?: Categories): Promise<Categories | null> {
  if (categoryListId) {
    const list = await categoryListService.getCategoryListById(categoryListId);
    return list ? list.categories : null;
  }
  if (categories) return categories;
  const defaultList = await categoryListService.getDefaultCategoryList();
  return defaultList ? defaultList.categories : null;
}

async function resolveCategoriesFromBody(body: any): Promise<Categories | null> {
  const { categoryListId, categories } = body;
  if (categoryListId) {
    const list = await categoryListService.getCategoryListById(categoryListId);
    return list ? list.categories : null;
  }
  if (categories) {
    try { return typeof categories === 'string' ? JSON.parse(categories) : categories; }
    catch { return null; }
  }
  const defaultList = await categoryListService.getDefaultCategoryList();
  return defaultList ? defaultList.categories : null;
}