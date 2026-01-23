import { Document, Types } from 'mongoose';
import { ISplitEntry } from './models/TransactionSplit.model';

export interface Transaction {
  date: string;
  description: string;
  subDescription: string;
  type: string; // e.g., "Debit" or "Credit"
  amount: number;
  balance?: number;
  hasSplit?: boolean;
  splits?: ISplitEntry[];
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

// User split information for receipts
export interface UserSplit {
  userId: string;
  userName?: string; // For display purposes
  amount: number;
  percentage?: number;
}

// Enhanced receipt item with split support
export interface ReceiptItemWithSplit {
  originalText: string;
  suffixText?: string;
  readableDescription: string;
  price: number;
  category?: string;
  userSplits?: UserSplit[];
  isSplit?: boolean;
}

// Request for saving receipt with splits
export interface SaveReceiptRequest {
  items: ReceiptItemWithSplit[];
  userId?: string; // Primary user (optional if all items are split)
  store?: string;
  date?: string;
}

// Response for receipt with user totals
export interface ReceiptWithUserTotals {
  _id: string;
  items: ReceiptItemWithSplit[];
  total: number;
  store?: string;
  date: Date;
  userTotals: { [userId: string]: number };
  userIds: string[];
}

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

// Split configuration for receipts
export interface SplitConfig {
  type: 'equal' | 'percentage' | 'custom';
  userIds: string[];
  percentages?: { [userId: string]: number }; // For percentage splits
  amounts?: { [userId: string]: number }; // For custom amount splits
}

// Request to apply split to receipt items
export interface ApplySplitRequest {
  receiptId: string;
  itemIndices: number[]; // Which items to split
  splitConfig: SplitConfig;
}

// Saved Report Types
export interface ISavedReport {
  userId: Types.ObjectId;
  name: string;
  description?: string;
  data: (string | number)[][];
  originalFileName?: string;
  categoryListId?: Types.ObjectId;
  metadata?: {
    totalTransactions: number;
    categorizedCount: number;
    uncategorizedCount: number;
    totalAmount?: number;
  };
}

export interface ISavedReportDocument extends ISavedReport, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSavedReportRequest {
  userId: string;
  name: string;
  description?: string;
  data: (string | number)[][];
  originalFileName?: string;
  categoryListId?: string;
  metadata?: {
    totalTransactions: number;
    categorizedCount: number;
    uncategorizedCount: number;
    totalAmount?: number;
  };
}

export interface UpdateSavedReportRequest {
  name?: string;
  description?: string;
  data?: (string | number)[][];
  metadata?: {
    totalTransactions: number;
    categorizedCount: number;
    uncategorizedCount: number;
    totalAmount?: number;
  };
}

export interface ReceiptMatch {
  receiptId: string;
  matchType: 'amount' | 'date' | 'combined' | 'manual';
  confidence: number; // 0-1
  receipt?: {
    _id: string;
    total: number;
    date: Date;
    store?: string;
    items: any[];
    userSplits?: {
      userId: string;
      userName?: string;
      amount: number;
      percentage?: number;
    }[];
  };
}

export interface TransactionWithReceipt extends Transaction {
  matchedReceipt?: ReceiptMatch;
  adjustedAmount?: number; // Amount after applying user's split
  originalAmount?: number; // Keep track of original
}

export interface MatchReceiptsRequest {
  transactions: Transaction[];
  userId: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface MatchReceiptsResponse {
  transactions: TransactionWithReceipt[];
  matchedCount: number;
  unmatchedCount: number;
  matches: {
    transactionIndex: number;
    receiptId: string;
    confidence: number;
  }[];
}

export interface ManualMatchRequest {
  transactionIndex: number;
  receiptId: string;
  userId: string;
}