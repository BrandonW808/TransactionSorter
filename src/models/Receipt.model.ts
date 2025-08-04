import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for user split information
export interface IUserSplit {
    userId: string;
    amount: number;
    percentage?: number; // Optional percentage (e.g., 50 for 50%)
}

export interface IReceiptItem {
    originalText: string;
    suffixText?: string;
    readableDescription: string;
    price: number;
    category?: string;
    // New: Support for splits
    userSplits?: IUserSplit[]; // If not provided, defaults to single user
    isSplit?: boolean; // Flag to indicate if this item is split
}

export interface IReceipt extends Document {
    userId?: string; // Primary user (if receipt is not split)
    userIds?: string[]; // All users involved in this receipt
    items: IReceiptItem[];
    total: number;
    store?: string;
    date: Date;
    createdAt: Date;
    updatedAt: Date;
    calculateTotal(): number;
    calculateUserTotal(userId: string): number;
    getUserSummary(): { [userId: string]: number };
}

const UserSplitSchema: Schema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    percentage: {
        type: Number,
        min: 0,
        max: 100
    }
}, { _id: false });

const ReceiptItemSchema: Schema = new Schema({
    originalText: {
        type: String,
        required: true
    },
    suffixText: {
        type: String
    },
    readableDescription: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    category: {
        type: String
    },
    userSplits: [UserSplitSchema],
    isSplit: {
        type: Boolean,
        default: false
    }
}, { _id: false });

const ReceiptSchema: Schema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    userIds: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    items: [ReceiptItemSchema],
    total: {
        type: Number,
        required: true
    },
    store: {
        type: String
    },
    date: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for user queries
ReceiptSchema.index({ userId: 1, date: -1 });
ReceiptSchema.index({ userIds: 1, date: -1 });

// Virtual for item count
ReceiptSchema.virtual<IReceipt>('itemCount').get(function () {
    return this.items.length;
});

// Method to calculate total
ReceiptSchema.methods.calculateTotal = function () {
    this.total = this.items.reduce((sum: number, item: IReceiptItem) => sum + item.price, 0);
    return this.total;
};

// Method to calculate total for a specific user
ReceiptSchema.methods.calculateUserTotal = function (userId: string): number {
    return this.items.reduce((sum: number, item: IReceiptItem) => {
        if (!item.isSplit || !item.userSplits) {
            // If not split, check if this user is the primary user
            return this.userId?.toString() === userId ? sum + item.price : sum;
        }

        // Find this user's split
        const userSplit = item.userSplits.find(split => split.userId.toString() === userId);
        return userSplit ? sum + userSplit.amount : sum;
    }, 0);
};

// Method to get summary of amounts per user
ReceiptSchema.methods.getUserSummary = function (): { [userId: string]: number } {
    const summary: { [userId: string]: number } = {};

    this.items.forEach((item: IReceiptItem) => {
        if (!item.isSplit || !item.userSplits) {
            // If not split, assign to primary user
            if (this.userId) {
                const userIdStr = this.userId.toString();
                summary[userIdStr] = (summary[userIdStr] || 0) + item.price;
            }
        } else {
            // Split among users
            item.userSplits.forEach((split: IUserSplit) => {
                const userIdStr = split.userId.toString();
                summary[userIdStr] = (summary[userIdStr] || 0) + split.amount;
            });
        }
    });

    return summary;
};

// Static method to get receipts by user (including split receipts)
ReceiptSchema.statics.findByUser = function (userId: string) {
    return this.find({
        $or: [
            { userId: userId },
            { userIds: userId },
            { 'items.userSplits.userId': userId }
        ]
    }).sort({ date: -1 });
};

// Pre-save hook to update userIds array
ReceiptSchema.pre('save', function (next) {
    const receipt = this as unknown as IReceipt;
    const allUserIds = new Set<string>();

    // Add primary user if exists
    if (receipt.userId) {
        allUserIds.add(receipt.userId.toString());
    }

    // Add all users from splits
    receipt.items.forEach(item => {
        if (item.userSplits) {
            item.userSplits.forEach(split => {
                allUserIds.add(split.userId.toString());
            });
        }
    });

    // Update userIds array
    receipt.userIds = Array.from(allUserIds);

    next();
});

export interface ReceiptModel extends Model<IReceipt> {
    findByUser(userId: string): Promise<IReceipt[]>;
}

export default mongoose.model<IReceipt, ReceiptModel>('Receipt', ReceiptSchema);

// Helper type for receipt item parsing
export type ReceiptItem = {
    originalText: string;
    suffixText?: string;
    readableDescription: string;
    price: number;
    userSplits?: {
        userId: string;
        amount: number;
        percentage?: number;
    }[];
    isSplit?: boolean;
};
