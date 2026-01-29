import mongoose, { Schema, Document } from 'mongoose';

// A single regex-based extraction rule for one line pattern on a receipt.
// `pattern` is stored as a string and compiled at runtime.
export interface ILineRule {
  /** Human-readable label shown in the UI (e.g. "item with inline price"). */
  label: string;
  /**
   * Regex string that the raw line is tested against.
   * Named capture groups are used to extract fields:
   *   - `desc`  → item description
   *   - `price` → numeric price string
   *   - `qty`   → optional quantity
   *   - `unit`  → optional unit (kg, lb, …)
   */
  pattern: string;
  /**
   * Maps capture-group names to the `ParsedReceiptLine` fields they populate.
   * Keys are capture-group names; values are one of
   * `"description" | "price" | "quantity" | "unit"`.
   */
  captures: Record<string, 'description' | 'price' | 'quantity' | 'unit'>;
}

export interface IReceiptFormat extends Document {
  /** Unique display name for this format (e.g. "Metro Quebec"). */
  name: string;
  /**
   * Optional keywords that, when found anywhere in the raw text, increase the
   * likelihood that this format is the correct one during auto-detection.
   */
  storeKeywords: string[];
  /**
   * Lines whose trimmed, upper-cased text matches any of these strings exactly
   * are skipped entirely (section dividers, store addresses, etc.).
   */
  sectionHeaders: string[];
  /**
   * Lines whose trimmed, lower-cased text *starts with* any of these strings
   * are recognised as totals/subtotals and are not treated as purchasable items.
   * The last such line's numeric value is used as the receipt total.
   */
  totalKeywords: string[];
  /**
   * Lines whose trimmed, lower-cased text *starts with* any of these strings
   * are recognised as discounts applied to the preceding item.
   */
  discountIndicators: string[];
  /**
   * Ordered list of line-parsing rules.  Each incoming line is tested against
   * every rule in order; the first match wins.
   */
  lineRules: ILineRule[];
  createdAt: Date;
  updatedAt: Date;
}

const LineRuleSchema = new Schema<ILineRule>(
  {
    label: { type: String, required: true },
    pattern: { type: String, required: true },
    captures: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const ReceiptFormatSchema = new Schema<IReceiptFormat>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    storeKeywords: [{ type: String }],
    sectionHeaders: [{ type: String }],
    totalKeywords: [{ type: String }],
    discountIndicators: [{ type: String }],
    lineRules: [LineRuleSchema],
  },
  { timestamps: true }
);

ReceiptFormatSchema.index({ name: 1 }, { unique: true });

export default mongoose.model<IReceiptFormat>(
  'ReceiptFormat',
  ReceiptFormatSchema
);
