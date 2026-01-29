// src/models/OCRDictionary.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IOCRCorrection extends Document {
    /** The incorrect text as recognized by OCR */
    ocrText: string;
    /** The correct text as provided by the user */
    correctedText: string;
    /** How many times this correction has been applied */
    frequency: number;
    /** Source context (e.g., store name) for better matching */
    context?: string;
    createdAt: Date;
    updatedAt: Date;
}

const OCRCorrectionSchema = new Schema<IOCRCorrection>(
    {
        ocrText: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        correctedText: {
            type: String,
            required: true,
            trim: true,
        },
        frequency: {
            type: Number,
            default: 1,
        },
        context: {
            type: String,
            trim: true,
        },
    },
    { timestamps: true }
);

// Compound index for efficient lookups
OCRCorrectionSchema.index({ ocrText: 1, context: 1 }, { unique: true });

export default mongoose.model<IOCRCorrection>('OCRCorrection', OCRCorrectionSchema);