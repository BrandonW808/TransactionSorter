import { Router } from 'express';
import multer from 'multer';
import {
    parseReceipt,
    saveReceiptData,
    getUserReceipts,
    getReceiptDetails,
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
router.delete('/receipt/:id', deleteReceiptById);

// Translation management
router.get('/translations', getTranslations);
router.post('/translations', createTranslation);
router.put('/translations/:id', editTranslation);
router.delete('/translations/:id', removeTranslation);
router.get('/translate', translateText);

export default router;
