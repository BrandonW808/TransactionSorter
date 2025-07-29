import mongoose, { Schema, Document } from 'mongoose';

export interface ITranslationMapping extends Document {
    original: string;
    translation: string;
    category?: string;
    userId?: string;
    createdAt: Date;
    updatedAt: Date;
    usageCount: number;
    incrementUsage(): Promise<this>;
}

const TranslationMappingSchema: Schema = new Schema({
    original: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    translation: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        trim: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    usageCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index for fast lookups
TranslationMappingSchema.index({ original: 1 });
TranslationMappingSchema.index({ userId: 1 });

// Static method to find or create a mapping
TranslationMappingSchema.statics.findOrCreate = async function (
    original: string,
    translation: string,
    userId?: string
) {
    let mapping = await this.findOne({ original });
    if (!mapping) {
        mapping = await this.create({ original, translation, userId });
    }
    return mapping;
};

// Method to increment usage count
TranslationMappingSchema.methods.incrementUsage = async function () {
    this.usageCount += 1;
    return this.save();
};

export default mongoose.model<ITranslationMapping>('TranslationMapping', TranslationMappingSchema);
