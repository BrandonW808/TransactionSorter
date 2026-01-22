// src/models/TransactionSplit.model.ts
import { Schema, model } from 'mongoose';

export interface ITransactionSplit {
    transactionId: string; // Unique identifier for the transaction
    originalDescription: string;
    originalAmount: number;
    date: Date;
    splits: Array<{
        userId: Schema.Types.ObjectId;
        userName?: string;
        amount: number;
        percentage: number;
    }>;
    createdBy?: Schema.Types.ObjectId;
}

const transactionSplitSchema = new Schema<ITransactionSplit>(
    {
        transactionId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        originalDescription: {
            type: String,
            required: true
        },
        originalAmount: {
            type: Number,
            required: true
        },
        date: {
            type: Date,
            required: true
        },
        splits: [{
            userId: {
                type: Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            userName: String,
            amount: {
                type: Number,
                required: true
            },
            percentage: {
                type: Number,
                required: true
            }
        }],
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    {
        timestamps: true
    }
);

export const TransactionSplitModel = model<ITransactionSplit>('TransactionSplit', transactionSplitSchema);