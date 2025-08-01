import { Request, Response } from 'express';
import { parseTransactionCSV, parseSharedCsv } from '../parser';
import { categorizeTransactions, processSharedTransactions } from '../transactions';
import * as categoryListService from '../services/categoryListService';
import { CategorizeRequest, Categories } from '../types';

export const categorize = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactions, categories, sharedTransactions, categoryListId }: CategorizeRequest & { categoryListId?: string } = req.body;

    if (!transactions || !Array.isArray(transactions)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request: transactions array is required'
      });
      return;
    }

    let categoriesToUse: Categories;

    // If categoryListId is provided, use that category list
    if (categoryListId) {
      const categoryList = await categoryListService.getCategoryListById(categoryListId);
      if (!categoryList) {
        res.status(404).json({
          success: false,
          error: 'Category list not found'
        });
        return;
      }
      categoriesToUse = categoryList.categories;
    }
    // If categories are provided directly, use those
    else if (categories) {
      categoriesToUse = categories;
    }
    // Otherwise, use the default category list
    else {
      const defaultList = await categoryListService.getDefaultCategoryList();
      if (!defaultList) {
        res.status(500).json({
          success: false,
          error: 'No default category list found'
        });
        return;
      }
      categoriesToUse = defaultList.categories;
    }

    let output = categorizeTransactions(transactions, categoriesToUse);

    if (sharedTransactions && sharedTransactions.length > 0) {
      output = processSharedTransactions(output, sharedTransactions);
    }

    res.json({ success: true, data: output });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to categorize transactions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const categorizeCsv = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files || !files.transactions || files.transactions.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No transactions CSV file uploaded'
      });
      return;
    }

    const transactionsCsv = files.transactions[0].buffer.toString('utf-8');
    const sharedCsv = files.shared && files.shared[0] ? files.shared[0].buffer.toString('utf-8') : null;

    const transactions = parseTransactionCSV(transactionsCsv);

    const sharedTransactions = sharedCsv ? parseSharedCsv(sharedCsv) : [];

    let categoriesToUse: Categories;
    const { categoryListId } = req.body;

    // If categoryListId is provided, use that category list
    if (categoryListId) {
      const categoryList = await categoryListService.getCategoryListById(categoryListId);
      if (!categoryList) {
        res.status(404).json({
          success: false,
          error: 'Category list not found'
        });
        return;
      }
      categoriesToUse = categoryList.categories;
    }
    // If custom categories are provided, use those
    else if (req.body.categories) {
      try {
        categoriesToUse = JSON.parse(req.body.categories);
      } catch (e) {
        res.status(400).json({
          success: false,
          error: 'Invalid categories JSON format'
        });
        return;
      }
    }
    // Otherwise, use the default category list
    else {
      const defaultList = await categoryListService.getDefaultCategoryList();
      if (!defaultList) {
        res.status(500).json({
          success: false,
          error: 'No default category list found'
        });
        return;
      }
      categoriesToUse = defaultList.categories;
    }

    let output = categorizeTransactions(transactions, categoriesToUse);
    if (sharedTransactions.length > 0) {
      output = processSharedTransactions(output, sharedTransactions);
    }

    res.json({ success: true, data: output });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to process CSV files',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const parseCsv = (req: Request, res: Response): void => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files || !files.transactions || files.transactions.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No transactions CSV file uploaded'
      });
      return;
    }

    const transactionsCsv = files.transactions[0].buffer.toString('utf-8');
    const sharedCsv = files.shared && files.shared[0] ? files.shared[0].buffer.toString('utf-8') : null;

    const transactions = parseTransactionCSV(transactionsCsv);
    const sharedTransactions = sharedCsv ? parseSharedCsv(sharedCsv) : [];

    res.json({
      success: true,
      data: {
        transactions,
        sharedTransactions,
        counts: {
          transactions: transactions.length,
          shared: sharedTransactions.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to parse CSV files',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const exportCsv = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactions, categories, sharedTransactions, categoryListId }: CategorizeRequest & { categoryListId?: string } = req.body;

    if (!transactions || !Array.isArray(transactions)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request: transactions array is required'
      });
      return;
    }

    let categoriesToUse: Categories;

    // If categoryListId is provided, use that category list
    if (categoryListId) {
      const categoryList = await categoryListService.getCategoryListById(categoryListId);
      if (!categoryList) {
        res.status(404).json({
          success: false,
          error: 'Category list not found'
        });
        return;
      }
      categoriesToUse = categoryList.categories;
    }
    // If categories are provided directly, use those
    else if (categories) {
      categoriesToUse = categories;
    }
    // Otherwise, use the default category list
    else {
      const defaultList = await categoryListService.getDefaultCategoryList();
      if (!defaultList) {
        res.status(500).json({
          success: false,
          error: 'No default category list found'
        });
        return;
      }
      categoriesToUse = defaultList.categories;
    }

    let output = categorizeTransactions(transactions, categoriesToUse);

    if (sharedTransactions && sharedTransactions.length > 0) {
      output = processSharedTransactions(output, sharedTransactions);
    }

    // Convert to CSV format
    const csvContent = output.map(row =>
      row.map(cell => typeof cell === "string" && cell.includes(",") ? `"${cell}"` : cell).join(",")
    ).join("\n");

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="categorized_transactions_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to export CSV',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
