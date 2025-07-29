import { Router } from 'express';
import multer from 'multer';
import * as receiptController from '../controllers/receipt.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/receipts/parse
 * Upload and parse receipt CSV files
 */
router.post('/parse-receipt-csv',
    upload.fields([
        { name: 'receipt', maxCount: 1 },
    ]),
    receiptController.parseReceipt
);

export default router;
