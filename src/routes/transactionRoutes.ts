import { Router } from 'express';
import multer from 'multer';
import * as transactionController from '../controllers/transaction.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/transactions/categorize
 * Categorize transactions using JSON input
 */
router.post('/categorize', transactionController.categorize);

/**
 * POST /api/transactions/categorize-csv
 * Upload and categorize CSV files
 */
router.post('/categorize-csv', 
  upload.fields([
    { name: 'transactions', maxCount: 1 },
    { name: 'shared', maxCount: 1 }
  ]), 
  transactionController.categorizeCsv
);

/**
 * POST /api/transactions/parse-csv
 * Parse CSV without categorization (for testing/validation)
 */
router.post('/parse-csv',
  upload.fields([
    { name: 'transactions', maxCount: 1 },
    { name: 'shared', maxCount: 1 }
  ]),
  transactionController.parseCsv
);

/**
 * POST /api/transactions/export-csv
 * Get categorized transactions as downloadable CSV file
 */
router.post('/export-csv', transactionController.exportCsv);

export default router;
