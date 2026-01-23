// src/routes/transactionRoutes.ts
import { Router } from 'express';
import multer from 'multer';
import {
  categorize,
  categorizeCsv,
  parseCsv,
  exportCsv,
  matchReceipts,
  manualMatch,
  categorizeWithReceipts,
  getPotentialMatches,
  splitTransaction,
  getTransactionSplits,
  deleteTransactionSplit,
  categorizeWithSplits,
  categorizeForUser,
  getAllSplits
} from '../controllers/transaction.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Existing routes
router.post('/categorize', categorize);
router.post('/categorize-csv', upload.fields([
  { name: 'transactions', maxCount: 1 },
  { name: 'shared', maxCount: 1 }
]), categorizeCsv);
router.post('/parse-csv', upload.fields([
  { name: 'transactions', maxCount: 1 },
  { name: 'shared', maxCount: 1 }
]), parseCsv);
router.post('/export-csv', exportCsv);

// Receipt matching routes
router.post('/match-receipts', matchReceipts);
router.post('/manual-match', manualMatch);
router.post('/potential-matches', getPotentialMatches);
router.post('/categorize-with-receipts', upload.fields([
  { name: 'transactions', maxCount: 1 },
  { name: 'shared', maxCount: 1 }
]), categorizeWithReceipts);

// Split routes
router.post('/split', splitTransaction);
router.post('/get-splits', getTransactionSplits);
router.get('/splits', getAllSplits);
router.delete('/split/:transactionId', deleteTransactionSplit);
router.post('/categorize-with-splits', upload.fields([
  { name: 'transactions', maxCount: 1 },
  { name: 'shared', maxCount: 1 }
]), categorizeWithSplits);

// User-specific categorization
router.post('/categorize-for-user', upload.fields([
  { name: 'transactions', maxCount: 1 },
  { name: 'shared', maxCount: 1 }
]), categorizeForUser);

export default router;