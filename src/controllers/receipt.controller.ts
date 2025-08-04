import { Request, Response } from "express";
import {
    parseReceiptCSV,
    parseReceiptLines,
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
    getReceiptWithUserTotals
} from "../services/receiptService";
import { SaveReceiptRequest, ApplySplitRequest } from "../types";

export const parseReceipt = async (req: Request, res: Response): Promise<void> => {
    try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        if (!files || !files.receipt || files.receipt.length === 0) {
            res.status(400).json({
                success: false,
                error: 'No receipt CSV file uploaded'
            });
            return;
        }

        const receiptCsv = files.receipt[0].buffer.toString('utf-8');
        const parsedReceipt = await parseReceiptCSV(receiptCsv);

        res.json({
            success: true,
            data: parsedReceipt
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to parse receipt'
        });
    }
};

export const saveReceiptData = async (req: Request, res: Response): Promise<void> => {
    try {
        const { items, userId, store, date } = req.body as SaveReceiptRequest;

        if (!items || !Array.isArray(items)) {
            res.status(400).json({
                success: false,
                error: 'Invalid receipt items'
            });
            return;
        }

        // Check if any items have splits
        const hasSplits = items.some(item => item.isSplit && item.userSplits && item.userSplits.length > 0);

        let receipt;
        if (hasSplits) {
            receipt = await saveReceiptWithSplits(items, store, date);
        } else {
            if (!userId) {
                res.status(400).json({
                    success: false,
                    error: 'User ID is required for non-split receipts'
                });
                return;
            }
            receipt = await saveReceipt(items, userId, store, date);
        }

        res.json({
            success: true,
            data: receipt
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to save receipt'
        });
    }
};

export const getUserReceipts = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;

        if (!userId) {
            res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
            return;
        }

        const receipts = await getReceiptsByUser(userId);

        res.json({
            success: true,
            data: receipts
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get receipts'
        });
    }
};

export const getReceiptDetails = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id) {
            res.status(400).json({
                success: false,
                error: 'Receipt ID is required'
            });
            return;
        }

        const receipt = await getReceiptById(id);

        if (!receipt) {
            res.status(404).json({
                success: false,
                error: 'Receipt not found'
            });
            return;
        }

        res.json({
            success: true,
            data: receipt
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get receipt'
        });
    }
};

export const getReceiptWithTotals = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id) {
            res.status(400).json({
                success: false,
                error: 'Receipt ID is required'
            });
            return;
        }

        const receipt = await getReceiptWithUserTotals(id);

        if (!receipt) {
            res.status(404).json({
                success: false,
                error: 'Receipt not found'
            });
            return;
        }

        res.json({
            success: true,
            data: receipt
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get receipt with totals'
        });
    }
};

export const applySplitToItems = async (req: Request, res: Response): Promise<void> => {
    try {
        const { receiptId, itemIndices, splitConfig } = req.body as ApplySplitRequest;

        if (!receiptId || !itemIndices || !splitConfig) {
            res.status(400).json({
                success: false,
                error: 'Receipt ID, item indices, and split configuration are required'
            });
            return;
        }

        const updatedReceipt = await applyItemSplits(receiptId, itemIndices, splitConfig);

        res.json({
            success: true,
            data: updatedReceipt
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to apply split'
        });
    }
};

export const deleteReceiptById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id) {
            res.status(400).json({
                success: false,
                error: 'Receipt ID is required'
            });
            return;
        }

        await deleteReceipt(id);

        res.json({
            success: true,
            message: 'Receipt deleted successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete receipt'
        });
    }
};

// Translation management functions remain the same
export const getTranslations = async (req: Request, res: Response): Promise<void> => {
    try {
        const translations = await getAllTranslations();
        res.json({
            success: true,
            data: translations
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get translations'
        });
    }
};

export const createTranslation = async (req: Request, res: Response): Promise<void> => {
    try {
        const { originalText, translatedText } = req.body;

        if (!originalText || !translatedText) {
            res.status(400).json({
                success: false,
                error: 'Both originalText and translatedText are required'
            });
            return;
        }

        const translation = await addTranslation(originalText, translatedText);
        res.json({
            success: true,
            data: translation
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create translation'
        });
    }
};

export const editTranslation = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { originalText, translatedText } = req.body;

        if (!id || !originalText || !translatedText) {
            res.status(400).json({
                success: false,
                error: 'ID, originalText, and translatedText are required'
            });
            return;
        }

        const translation = await updateTranslation(id, originalText, translatedText);
        
        if (!translation) {
            res.status(404).json({
                success: false,
                error: 'Translation not found'
            });
            return;
        }

        res.json({
            success: true,
            data: translation
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update translation'
        });
    }
};

export const removeTranslation = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id) {
            res.status(400).json({
                success: false,
                error: 'Translation ID is required'
            });
            return;
        }

        await deleteTranslation(id);
        res.json({
            success: true,
            message: 'Translation deleted successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete translation'
        });
    }
};

export const translateText = async (req: Request, res: Response): Promise<void> => {
    try {
        const { text } = req.query;

        if (!text || typeof text !== 'string') {
            res.status(400).json({
                success: false,
                error: 'Text parameter is required'
            });
            return;
        }

        const translation = await getTranslation(text);
        res.json({
            success: true,
            data: translation
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to translate text'
        });
    }
};
