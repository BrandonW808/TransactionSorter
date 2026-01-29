import { Request, Response } from "express";
import {
  parseReceiptCSV,
  getAllTranslations,
  addTranslation,
  updateTranslation,
  deleteTranslation,
  getTranslation,
  saveReceipt,
  saveReceiptWithSplits,
  getReceiptsByUser,
  getReceiptById,
  deleteReceipt,
  applyItemSplits,
  getReceiptWithUserTotals,
} from "../services/receiptService";
import {
  SaveReceiptRequest,
  ApplySplitRequest,
  CreateReceiptFormatRequest,
  UpdateReceiptFormatRequest,
  DetectFormatRequest,
} from "../types";
import Receipt from "../models/Receipt.model";
import { extractTextFromImage, parseReceiptText, receiptToCSV } from "../services/ocrService";
import {
  createReceiptFormat,
  getAllReceiptFormats,
  getReceiptFormatById,
  updateReceiptFormat,
  deleteReceiptFormat,
  detectFormat,
} from "../services/receiptFormatService";

import {
  getAllCorrections,
  addCorrection,
  addCorrectionsFromDiff,
  deleteCorrection as deleteCorrectionService,
  updateCorrection,
} from '../services/ocrDictionaryService';

// ---------------------------------------------------------------------------
// Receipt CSV parsing
// ---------------------------------------------------------------------------

/** Parse an uploaded receipt CSV file and return structured items. */
export const parseReceipt = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files || !files.receipt || files.receipt.length === 0) {
      res.status(400).json({ success: false, error: "No receipt CSV file uploaded" });
      return;
    }

    const receiptCsv = files.receipt[0].buffer.toString("utf-8");
    const parsedReceipt = await parseReceiptCSV(receiptCsv);

    res.json({ success: true, data: parsedReceipt });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse receipt",
    });
  }
};

// ---------------------------------------------------------------------------
// Receipt persistence & retrieval
// ---------------------------------------------------------------------------

/** Save parsed receipt items (with or without per-item splits) to the database. */
export const saveReceiptData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { items, userId, store, date } = req.body as SaveReceiptRequest;

    if (!items || !Array.isArray(items)) {
      res.status(400).json({ success: false, error: "Invalid receipt items" });
      return;
    }

    const hasSplits = items.some(
      (item) => item.isSplit && item.userSplits && item.userSplits.length > 0
    );

    let receipt;
    if (hasSplits) {
      receipt = await saveReceiptWithSplits(items, store, date);
    } else {
      if (!userId) {
        res.status(400).json({
          success: false,
          error: "User ID is required for non-split receipts",
        });
        return;
      }
      receipt = await saveReceipt(items, userId, store, date);
    }

    res.json({ success: true, data: receipt });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to save receipt",
    });
  }
};

/** Return all saved receipts for a given user. */
export const getUserReceipts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    if (!userId) {
      res.status(400).json({ success: false, error: "User ID is required" });
      return;
    }

    const receipts = await getReceiptsByUser(userId);
    res.json({ success: true, data: receipts });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get receipts",
    });
  }
};

/** Return a single receipt by ID. */
export const getReceiptDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: "Receipt ID is required" });
      return;
    }

    const receipt = await getReceiptById(id);
    if (!receipt) {
      res.status(404).json({ success: false, error: "Receipt not found" });
      return;
    }

    res.json({ success: true, data: receipt });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get receipt",
    });
  }
};

/** Return a receipt enriched with per-user totals. */
export const getReceiptWithTotals = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: "Receipt ID is required" });
      return;
    }

    const receipt = await getReceiptWithUserTotals(id);
    if (!receipt) {
      res.status(404).json({ success: false, error: "Receipt not found" });
      return;
    }

    res.json({ success: true, data: receipt });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get receipt with totals",
    });
  }
};

/** Apply a split configuration to selected items in an existing receipt. */
export const applySplitToItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { receiptId, itemIndices, splitConfig } = req.body as ApplySplitRequest;

    if (!receiptId || !itemIndices || !splitConfig) {
      res.status(400).json({
        success: false,
        error: "Receipt ID, item indices, and split configuration are required",
      });
      return;
    }

    const updatedReceipt = await applyItemSplits(receiptId, itemIndices, splitConfig);
    res.json({ success: true, data: updatedReceipt });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to apply split",
    });
  }
};

/** Delete a receipt by ID. */
export const deleteReceiptById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: "Receipt ID is required" });
      return;
    }

    await deleteReceipt(id);
    res.json({ success: true, message: "Receipt deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete receipt",
    });
  }
};

// ---------------------------------------------------------------------------
// Translation management
// ---------------------------------------------------------------------------

/** Return all stored translation mappings. */
export const getTranslations = async (req: Request, res: Response): Promise<void> => {
  try {
    const translations = await getAllTranslations();
    res.json({ success: true, data: translations });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get translations",
    });
  }
};

/** Create a new translation mapping. */
export const createTranslation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { originalText, translatedText } = req.body;
    if (!originalText || !translatedText) {
      res.status(400).json({
        success: false,
        error: "Both originalText and translatedText are required",
      });
      return;
    }

    const translation = await addTranslation(originalText, translatedText);
    res.json({ success: true, data: translation });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create translation",
    });
  }
};

/** Update an existing translation mapping. */
export const editTranslation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { originalText, translatedText } = req.body;

    if (!id || !originalText || !translatedText) {
      res.status(400).json({
        success: false,
        error: "ID, originalText, and translatedText are required",
      });
      return;
    }

    const translation = await updateTranslation(id, originalText, translatedText);
    if (!translation) {
      res.status(404).json({ success: false, error: "Translation not found" });
      return;
    }

    res.json({ success: true, data: translation });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update translation",
    });
  }
};

/** Delete a translation mapping. */
export const removeTranslation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: "Translation ID is required" });
      return;
    }

    await deleteTranslation(id);
    res.json({ success: true, message: "Translation deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete translation",
    });
  }
};

/** Look up a single translation by text. */
export const translateText = async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.query;
    if (!text || typeof text !== "string") {
      res.status(400).json({ success: false, error: "Text parameter is required" });
      return;
    }

    const translation = await getTranslation(text);
    res.json({ success: true, data: translation });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to translate text",
    });
  }
};

/** Return the most-recent 50 receipts across all users. */
export const getAllReceipts = async (req: Request, res: Response): Promise<void> => {
  try {
    const receipts = await Receipt.find()
      .populate("userId")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, data: receipts });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get receipts",
    });
  }
};

// ---------------------------------------------------------------------------
// Photo / OCR endpoints
// ---------------------------------------------------------------------------

/**
 * Upload a receipt photo with optional auto-correction.
 * Returns both raw and corrected text for user review.
 */
export const uploadReceiptPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files || !files.photo || files.photo.length === 0) {
      res.status(400).json({ success: false, error: 'No receipt photo uploaded' });
      return;
    }

    const photoBuffer = files.photo[0].buffer;
    const autoCorrect = req.body.autoCorrect !== 'false';
    const context = req.body.context;

    const ocrResult = await extractTextFromImage(photoBuffer, 'eng+fra', autoCorrect, context);

    if (ocrResult.confidence < 50) {
      res.status(400).json({
        success: false,
        error: 'Low OCR confidence. Please try a clearer photo.',
        confidence: ocrResult.confidence,
        rawText: ocrResult.text,
      });
      return;
    }

    // Use corrected text if available, otherwise raw text
    const textToParse = ocrResult.correctedText || ocrResult.text;
    const parsed = await parseReceiptText(textToParse);

    res.json({
      success: true,
      data: {
        rawText: ocrResult.text,
        correctedText: ocrResult.correctedText,
        appliedCorrections: ocrResult.appliedCorrections || [],
        ocrConfidence: ocrResult.confidence,
        parseConfidence: parsed.confidence,
        detectedFormat: parsed.detectedFormat,
        items: parsed.items,
        total: parsed.total,
        skippedLines: parsed.skippedLines,
        itemCount: parsed.items.length,
      },
    });
  } catch (error) {
    console.error('OCR Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process receipt photo',
    });
  }
};

/**
 * Parse user-corrected text and optionally learn from corrections.
 */
export const parseCorrectText = async (req: Request, res: Response): Promise<void> => {
  try {
    const { originalText, correctedText, learnCorrections, context } = req.body;

    if (!correctedText) {
      res.status(400).json({ success: false, error: 'correctedText is required' });
      return;
    }

    // If learning is enabled and we have both texts, extract and save corrections
    let learnedCorrections: { from: string; to: string }[] = [];
    if (learnCorrections && originalText && originalText !== correctedText) {
      const origLines = originalText.split('\n');
      const corrLines = correctedText.split('\n');
      const corrections = await addCorrectionsFromDiff(origLines, corrLines, context);
      learnedCorrections = corrections.map((c) => ({
        from: c.ocrText,
        to: c.correctedText,
      }));
    }

    // Parse the corrected text
    const parsed = await parseReceiptText(correctedText);

    res.json({
      success: true,
      data: {
        items: parsed.items,
        total: parsed.total,
        skippedLines: parsed.skippedLines,
        confidence: parsed.confidence,
        detectedFormat: parsed.detectedFormat,
        learnedCorrections,
      },
    });
  } catch (error) {
    console.error('Parse error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse corrected text',
    });
  }
};

/**
 * Upload a receipt photo, run OCR + format-aware parsing, and return CSV.
 */
export const convertPhotoToCSV = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files || !files.photo || files.photo.length === 0) {
      res.status(400).json({ success: false, error: "No receipt photo uploaded" });
      return;
    }

    const photoBuffer = files.photo[0].buffer;

    const ocrResult = await extractTextFromImage(photoBuffer);
    const parsed = await parseReceiptText(ocrResult.text);
    const csv = receiptToCSV(parsed);

    res.json({
      success: true,
      data: {
        csv,
        parsed: {
          items: parsed.items,
          total: parsed.total,
          confidence: parsed.confidence,
          detectedFormat: parsed.detectedFormat,
        },
        confidence: parsed.confidence,
      },
    });
  } catch (error) {
    console.error("Conversion Error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to convert photo to CSV",
    });
  }
};

// ---------------------------------------------------------------------------
// OCR Dictionary/Correction endpoints
// ---------------------------------------------------------------------------

/** Get all OCR corrections. */
export const getOCRCorrections = async (req: Request, res: Response): Promise<void> => {
  try {
    const context = req.query.context as string | undefined;
    const corrections = await getAllCorrections(context);
    res.json({ success: true, data: corrections });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get corrections',
    });
  }
};

/** Add a new OCR correction. */
export const createOCRCorrection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ocrText, correctedText, context } = req.body;

    if (!ocrText || !correctedText) {
      res.status(400).json({
        success: false,
        error: 'ocrText and correctedText are required',
      });
      return;
    }

    const correction = await addCorrection(ocrText, correctedText, context);
    res.json({ success: true, data: correction });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create correction',
    });
  }
};

/** Update an OCR correction. */
export const editOCRCorrection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { ocrText, correctedText, context } = req.body;

    if (!id || !ocrText || !correctedText) {
      res.status(400).json({
        success: false,
        error: 'id, ocrText, and correctedText are required',
      });
      return;
    }

    const correction = await updateCorrection(id, ocrText, correctedText, context);
    if (!correction) {
      res.status(404).json({ success: false, error: 'Correction not found' });
      return;
    }

    res.json({ success: true, data: correction });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update correction',
    });
  }
};

/** Delete an OCR correction. */
export const removeOCRCorrection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ success: false, error: 'Correction ID is required' });
      return;
    }

    const deleted = await deleteCorrectionService(id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Correction not found' });
      return;
    }

    res.json({ success: true, message: 'Correction deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete correction',
    });
  }
};

// ---------------------------------------------------------------------------
// Receipt-format CRUD endpoints
// ---------------------------------------------------------------------------

/** Return every stored receipt format. */
export const getReceiptFormats = async (req: Request, res: Response): Promise<void> => {
  try {
    const formats = await getAllReceiptFormats();
    res.json({ success: true, data: formats });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get receipt formats",
    });
  }
};

/** Create a new receipt format definition. */
export const createReceiptFormatHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = req.body as CreateReceiptFormatRequest;

    if (!data.name || !data.lineRules || data.lineRules.length === 0) {
      res.status(400).json({
        success: false,
        error: "name and at least one lineRule are required",
      });
      return;
    }

    const format = await createReceiptFormat(data);
    res.status(201).json({ success: true, data: format });
  } catch (error) {
    console.error(error);
    const statusCode =
      error instanceof Error && error.message.includes("duplicate key") ? 409 : 500;
    res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create receipt format",
    });
  }
};

/** Update an existing receipt format. */
export const updateReceiptFormatHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: "Format ID is required" });
      return;
    }

    const data = req.body as UpdateReceiptFormatRequest;
    const format = await updateReceiptFormat(id, data);

    if (!format) {
      res.status(404).json({ success: false, error: "Receipt format not found" });
      return;
    }

    res.json({ success: true, data: format });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update receipt format",
    });
  }
};

/** Delete a receipt format. */
export const deleteReceiptFormatHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: "Format ID is required" });
      return;
    }

    const deleted = await deleteReceiptFormat(id);
    if (!deleted) {
      res.status(404).json({ success: false, error: "Receipt format not found" });
      return;
    }

    res.json({ success: true, message: "Receipt format deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete receipt format",
    });
  }
};

/**
 * Auto-detect the best receipt format for a block of raw text.
 * Returns the winning format and its score, or an explicit null when nothing
 * matches.
 */
export const detectReceiptFormat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rawText } = req.body as DetectFormatRequest;

    if (!rawText || typeof rawText !== "string") {
      res.status(400).json({ success: false, error: "rawText is required" });
      return;
    }

    const result = await detectFormat(rawText);

    if (!result) {
      res.json({
        success: true,
        data: {
          detectedFormat: null,
          message: "No matching format found. The fallback parser will be used.",
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        detectedFormat: {
          id: result.format.id,
          name: result.format.name,
          score: result.score,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to detect format",
    });
  }
};

/**
 * Parse raw text using a *specific* format ID supplied in the request body.
 * Useful when the caller already knows which format to apply (e.g. after
 * running detection separately).
 */
export const parseWithFormat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { formatId, rawText } = req.body as {
      formatId: string;
      rawText: string;
    };

    if (!formatId || !rawText) {
      res.status(400).json({
        success: false,
        error: "Both formatId and rawText are required",
      });
      return;
    }

    const format = await getReceiptFormatById(formatId);
    if (!format) {
      res.status(404).json({ success: false, error: "Receipt format not found" });
      return;
    }

    const parsed = await parseReceiptText(rawText, format);

    res.json({
      success: true,
      data: {
        items: parsed.items,
        total: parsed.total,
        skippedLines: parsed.skippedLines,
        confidence: parsed.confidence,
        detectedFormat: parsed.detectedFormat,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse with format",
    });
  }
};
