import { Document, Types } from 'mongoose';

export interface Transaction {
  date: string;
  description: string;
  subDescription: string;
  type: string; // e.g., "Debit" or "Credit"
  amount: number;
  balance?: number;
}

export interface Categories {
  [mainCategory: string]: {
    [subCategory: string]: string[]; // array of keywords
  };
}

export interface SharedTransaction {
  description: string;
  total: number;
  brandon: number;
  expense: string;
}

export interface CategorizeRequest {
  transactions: Transaction[];
  categories?: Categories;
  sharedTransactions?: SharedTransaction[];
}

export interface CategorizeResponse {
  success: boolean;
  data?: (string | number)[][];
  error?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// Mongoose document interfaces
export interface IUser {
  name: string;
  email: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserDocument extends IUser, Document {
  _id: Types.ObjectId;
}

export interface ICategoryList {
  name: string;
  categories: Categories;
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICategoryListDocument extends ICategoryList, Document {
  _id: Types.ObjectId;
}

// Request interfaces
export interface CreateUserRequest {
  name: string;
  email: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
}

export interface CreateCategoryListRequest {
  name: string;
  categories: Categories;
  isDefault?: boolean;
}

export interface UpdateCategoryListRequest {
  name?: string;
  categories?: Categories;
  isDefault?: boolean;
}
