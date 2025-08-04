import { Router } from 'express';
import multer from 'multer';
import {
    parseReceipt,
    saveReceiptData,
    getUserReceipts,
    getReceiptDetails,
    getReceiptWithTotals,
    applySplitToItems,
    deleteReceiptById,
    getTranslations,
    createTranslation,
    editTranslation,
    removeTranslation,
    translateText
} from '../controllers/receipt.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Receipt parsing and management
router.post('/parse-receipt-csv', upload.fields([{ name: 'receipt', maxCount: 1 }]), parseReceipt);
router.post('/save', saveReceiptData);
router.get('/user/:userId', getUserReceipts);
router.get('/receipt/:id', getReceiptDetails);
router.get('/receipt/:id/with-totals', getReceiptWithTotals); // New endpoint for receipt with user totals
router.post('/receipt/apply-split', applySplitToItems); // New endpoint for applying splits
router.delete('/receipt/:id', deleteReceiptById);

// Translation management
router.get('/translations', getTranslations);
router.post('/translations', createTranslation);
router.put('/translations/:id', editTranslation);
router.delete('/translations/:id', removeTranslation);
router.get('/translate', translateText);

export default router;
