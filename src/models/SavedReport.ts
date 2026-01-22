// src/models/SavedReport.ts
import { Schema, model, Types } from 'mongoose';
import { ISavedReportDocument } from '../types';

const savedReportSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true
        },
        name: {
            type: String,
            required: [true, 'Report name is required'],
            trim: true,
            minlength: [1, 'Name must be at least 1 character long'],
            maxlength: [200, 'Name cannot exceed 200 characters']
        },
        description: {
            type: String,
            trim: true,
            maxlength: [1000, 'Description cannot exceed 1000 characters']
        },
        data: {
            type: [[Schema.Types.Mixed]],
            required: [true, 'Report data is required']
        },
        originalFileName: {
            type: String,
            trim: true
        },
        categoryListId: {
            type: Schema.Types.ObjectId,
            ref: 'CategoryList'
        },
        metadata: {
            totalTransactions: { type: Number, default: 0 },
            categorizedCount: { type: Number, default: 0 },
            uncategorizedCount: { type: Number, default: 0 },
            totalAmount: { type: Number, default: 0 }
        }
    },
    {
        timestamps: true,
        toJSON: {
            transform: (doc, ret) => {
                return ret;
            }
        }
    }
);

// Indexes
savedReportSchema.index({ userId: 1, createdAt: -1 });
savedReportSchema.index({ userId: 1, name: 'text' });

export const SavedReportModel = model<ISavedReportDocument>('SavedReport', savedReportSchema);