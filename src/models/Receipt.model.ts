import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReceiptItem {
    originalText: string;
    readableDescription: string;
    price: number;
    category?: string;
}

export interface IReceipt extends Document {
    userId?: string;
    items: IReceiptItem[];
    total: number;
    store?: string;
    date: Date;
    createdAt: Date;
    updatedAt: Date;
    calculateTotal(): number;
}

const ReceiptItemSchema: Schema = new Schema({
    originalText: {
        type: String,
        required: true
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
    }
}, { _id: false });

const ReceiptSchema: Schema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
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

// Virtual for item count
ReceiptSchema.virtual<IReceipt>('itemCount').get(function () {
    return this.items.length;
});

// Method to calculate total
ReceiptSchema.methods.calculateTotal = function () {
    this.total = this.items.reduce((sum: number, item: IReceiptItem) => sum + item.price, 0);
    return this.total;
};

// Static method to get receipts by user
ReceiptSchema.statics.findByUser = function (userId: string) {
    return this.find({ userId }).sort({ date: -1 });
};

export interface ReceiptModel extends Model<IReceipt> {
    findByUser(userId: string): Promise<IReceipt[]>;
}

export default mongoose.model<IReceipt, ReceiptModel>('Receipt', ReceiptSchema);

// Helper type for receipt item parsing
export type ReceiptItem = {
    originalText: string;
    readableDescription: string;
    price: number;
};
