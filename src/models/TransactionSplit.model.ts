// src/models/TransactionSplit.model.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface ISplitEntry {
    userId?: string;
    userName?: string;
    mainCategory?: string;
    subCategory?: string;
    amount: number;
    percentage: number;
    description?: string; // Override description for this split
}

export interface ITransactionSplit extends Document {
    transactionId: string;
    originalDescription: string;
    originalAmount: number;
    date: Date;
    splitType: 'user' | 'category' | 'combined';
    splits: ISplitEntry[];
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}

const SplitEntrySchema = new Schema({
    userId: { type: String },
    userName: { type: String },
    mainCategory: { type: String },
    subCategory: { type: String },
    amount: { type: Number, required: true },
    percentage: { type: Number, required: true },
    description: { type: String }
}, { _id: false });

const TransactionSplitSchema = new Schema({
    transactionId: { type: String, required: true, unique: true, index: true },
    originalDescription: { type: String, required: true },
    originalAmount: { type: Number, required: true },
    date: { type: Date, required: true },
    splitType: {
        type: String,
        enum: ['user', 'category', 'combined'],
        default: 'user'
    },
    splits: [SplitEntrySchema],
    createdBy: { type: String }
}, { timestamps: true });

export const TransactionSplitModel = mongoose.model<ITransactionSplit>('TransactionSplit', TransactionSplitSchema);