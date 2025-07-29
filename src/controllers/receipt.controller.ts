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
    getReceiptsByUser,
    getReceiptById,
    deleteReceipt
} from "../services/receiptService";

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
        const { items, userId, store } = req.body;

        if (!items || !Array.isArray(items)) {
            res.status(400).json({
                success: false,
                error: 'Invalid receipt items'
            });
            return;
        }

        const receipt = await saveReceipt(items, userId, store);

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

export const deleteReceiptById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const deleted = await deleteReceipt(id);

        if (!deleted) {
            res.status(404).json({
                success: false,
                error: 'Receipt not found'
            });
            return;
        }

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

// Translation endpoints
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
        const { original, translation, userId } = req.body;

        if (!original || !translation) {
            res.status(400).json({
                success: false,
                error: 'Original and translation text are required'
            });
            return;
        }

        const mapping = await addTranslation(original, translation, userId);
        res.json({
            success: true,
            data: mapping
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
        const { translation } = req.body;

        if (!translation) {
            res.status(400).json({
                success: false,
                error: 'Translation text is required'
            });
            return;
        }

        const mapping = await updateTranslation(id, translation);

        if (!mapping) {
            res.status(404).json({
                success: false,
                error: 'Translation not found'
            });
            return;
        }

        res.json({
            success: true,
            data: mapping
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

        const deleted = await deleteTranslation(id);

        if (!deleted) {
            res.status(404).json({
                success: false,
                error: 'Translation not found'
            });
            return;
        }

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
            translation: translation
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to translate text'
        });
    }
};
