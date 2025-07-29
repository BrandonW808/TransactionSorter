import { Schema, model } from 'mongoose';
import { ICategoryListDocument } from '../types';

const categoryListSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Category list name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    categories: {
      type: Schema.Types.Mixed,
      required: [true, 'Categories are required'],
      validate: {
        validator: function (v: any) {
          if (!v || typeof v !== 'object') return false;

          // Validate structure: { mainCategory: { subCategory: string[] } }
          for (const mainCat in v) {
            if (typeof v[mainCat] !== 'object') return false;

            for (const subCat in v[mainCat]) {
              if (!Array.isArray(v[mainCat][subCat])) return false;

              // Ensure all keywords are strings
              if (!v[mainCat][subCat].every((keyword: any) => typeof keyword === 'string')) {
                return false;
              }
            }
          }
          return true;
        },
        message: 'Categories must follow the structure: { mainCategory: { subCategory: string[] } }'
      }
    },
    isDefault: {
      type: Boolean,
      default: false
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
categoryListSchema.index({ name: 1 }, { unique: true });
categoryListSchema.index({ isDefault: 1 });

// Pre-save middleware to ensure only one default category list
categoryListSchema.pre('save', async function (next) {
  if (this.isDefault) {
    // If this is being set as default, unset any other defaults
    await model('CategoryList').updateMany(
      { _id: { $ne: this._id }, isDefault: true },
      { isDefault: false }
    );
  }
  next();
});

export const CategoryListModel = model<ICategoryListDocument>('CategoryList', categoryListSchema);
