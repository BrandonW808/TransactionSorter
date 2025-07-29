import { Schema, model } from 'mongoose';
import { IUserDocument } from '../types';

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address'
      ]
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
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ name: 'text' });

// Pre-save middleware
userSchema.pre('save', function (next) {
  // Additional validation or transformation logic can go here
  next();
});

export const UserModel = model<IUserDocument>('User', userSchema);
