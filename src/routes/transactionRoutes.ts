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
  categorizeWithSplits
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

// New receipt matching routes
router.post('/match-receipts', matchReceipts);
router.post('/manual-match', manualMatch);
router.post('/potential-matches', getPotentialMatches);
router.post('/categorize-with-receipts', upload.fields([
  { name: 'transactions', maxCount: 1 },
  { name: 'shared', maxCount: 1 }
]), categorizeWithReceipts);

router.post('/split', splitTransaction);
router.post('/get-splits', getTransactionSplits);
router.delete('/split/:transactionId', deleteTransactionSplit);
router.post('/categorize-with-splits', upload.fields([
  { name: 'transactions', maxCount: 1 },
  { name: 'shared', maxCount: 1 }
]), categorizeWithSplits);

export default router;