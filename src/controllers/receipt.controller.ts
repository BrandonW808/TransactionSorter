import { Request, Response } from "express";
import { parseReceiptCSV, parseReceiptLines } from "../services/receiptService";


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
        console.log(`Receipt: ${receiptCsv}`);
        const parsedReceipt = parseReceiptCSV(receiptCsv);
        console.log(`Pared Receipt: ${JSON.stringify(parsedReceipt)}`);
        res.send(parsedReceipt);
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
}