// src/routes/receipt.routes.ts
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
  translateText,
  uploadReceiptPhoto,
  convertPhotoToCSV,
  getReceiptFormats,
  createReceiptFormatHandler,
  updateReceiptFormatHandler,
  deleteReceiptFormatHandler,
  detectReceiptFormat,
  parseWithFormat,
  // New exports
  parseCorrectText,
  getOCRCorrections,
  createOCRCorrection,
  editOCRCorrection,
  removeOCRCorrection,
} from '../controllers/receipt.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ---------------------------------------------------------------------------
// Receipt parsing and management
// ---------------------------------------------------------------------------
router.post('/parse-receipt-csv', upload.fields([{ name: 'receipt', maxCount: 1 }]), parseReceipt);
router.post('/save', saveReceiptData);
router.get('/user/:userId', getUserReceipts);
router.get('/receipt/:id', getReceiptDetails);
router.get('/receipt/:id/with-totals', getReceiptWithTotals);
router.post('/receipt/apply-split', applySplitToItems);
router.delete('/receipt/:id', deleteReceiptById);

// ---------------------------------------------------------------------------
// Translation management
// ---------------------------------------------------------------------------
router.get('/translations', getTranslations);
router.post('/translations', createTranslation);
router.put('/translations/:id', editTranslation);
router.delete('/translations/:id', removeTranslation);
router.get('/translate', translateText);

// ---------------------------------------------------------------------------
// Photo / OCR endpoints
// ---------------------------------------------------------------------------
router.post('/upload-photo', upload.fields([{ name: 'photo', maxCount: 1 }]), uploadReceiptPhoto);
router.post('/photo-to-csv', upload.fields([{ name: 'photo', maxCount: 1 }]), convertPhotoToCSV);
router.post('/parse-corrected', parseCorrectText);

// ---------------------------------------------------------------------------
// OCR Corrections/Dictionary
// ---------------------------------------------------------------------------
router.get('/ocr-corrections', getOCRCorrections);
router.post('/ocr-corrections', createOCRCorrection);
router.put('/ocr-corrections/:id', editOCRCorrection);
router.delete('/ocr-corrections/:id', removeOCRCorrection);

// ---------------------------------------------------------------------------
// Receipt-format CRUD and detection
// ---------------------------------------------------------------------------
router.get('/formats', getReceiptFormats);
router.post('/formats', createReceiptFormatHandler);
router.put('/formats/:id', updateReceiptFormatHandler);
router.delete('/formats/:id', deleteReceiptFormatHandler);
router.post('/formats/detect', detectReceiptFormat);
router.post('/formats/parse', parseWithFormat);

export default router;