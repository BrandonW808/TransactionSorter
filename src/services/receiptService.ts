import TranslationMapping, { ITranslationMapping } from '../models/TranslationMapping.model';
import Receipt, { IReceipt, ReceiptItem } from '../models/Receipt.model';
import { SplitConfig, ReceiptWithUserTotals } from '../types';
import { parseReceiptText } from './ocrService';

/**
 * Parse a receipt CSV whose first row is a header line.
 * Finds the column named "EPICERIE" (case-sensitive) and feeds those values
 * through the format-aware parser via `parseReceiptLines`.
 */
export async function parseReceiptCSV(csv: string): Promise<ReceiptItem[]> {
  const lines = csv.trim().split("\n");
  const header = lines[0].trim();
  const colIndex = header.split(",").indexOf("EPICERIE");

  if (colIndex === -1) throw new Error("Column 'EPICERIE' not found.");

  const itemLines = lines.slice(1).map((line) => {
    const parts = line.split(",");
    return parts[colIndex].trim();
  });

  return parseReceiptLines(itemLines);
}

/**
 * Parse an array of receipt text lines into structured `ReceiptItem` objects.
 *
 * The lines are joined back into a single text block and fed through
 * `parseReceiptText`, which will auto-detect the best stored format or fall
 * back to the built-in heuristic parser.  Each successfully parsed line is
 * then run through the translation layer to produce a `readableDescription`.
 */
export async function parseReceiptLines(lines: string[]): Promise<ReceiptItem[]> {
  // Rejoin lines so the format-aware parser can see the full receipt text
  const rawText = lines.join('\n');

  const parsed = await parseReceiptText(rawText);

  const items: ReceiptItem[] = [];

  for (const line of parsed.items) {
    const readableDescription = await translateText(line.description);

    // Enrich description with quantity/unit when present
    let displayDesc = readableDescription;
    if (line.quantity && line.unit) {
      displayDesc += ` (${line.quantity} ${line.unit})`;
    } else if (line.quantity) {
      displayDesc += ` (${line.quantity}x)`;
    }

    items.push({
      originalText: line.originalLine,
      readableDescription: displayDesc,
      price: line.price,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Translation helpers
// ---------------------------------------------------------------------------

/**
 * Return every translation mapping stored in the database.
 */
export async function getAllTranslations(): Promise<ITranslationMapping[]> {
  return TranslationMapping.find({});
}

/**
 * Create a new original→translated mapping.
 */
export async function addTranslation(
  originalText: string,
  translatedText: string
): Promise<ITranslationMapping> {
  const translation = new TranslationMapping({
    original: originalText.trim(),
    translation: translatedText.trim(),
  });
  return translation.save();
}

/**
 * Overwrite an existing translation mapping by its database ID.
 */
export async function updateTranslation(
  id: string,
  originalText: string,
  translatedText: string
): Promise<ITranslationMapping | null> {
  return TranslationMapping.findByIdAndUpdate(
    id,
    { original: originalText.trim(), translation: translatedText.trim() },
    { new: true, runValidators: true }
  );
}

/**
 * Delete a translation mapping by its database ID.
 */
export async function deleteTranslation(id: string): Promise<void> {
  await TranslationMapping.findByIdAndDelete(id);
}

/**
 * Look up a single translation.  Returns the original text unchanged when no
 * mapping exists.
 */
export async function getTranslation(text: string): Promise<string> {
  const mapping = await TranslationMapping.findOne({ original: text.trim() });
  return mapping?.translation || text;
}

/**
 * Convenience wrapper around `getTranslation` for use inside parsers.
 */
export async function translateText(text: string): Promise<string> {
  return getTranslation(text);
}

// ---------------------------------------------------------------------------
// Receipt persistence
// ---------------------------------------------------------------------------

/**
 * Save a receipt with a designated primary user (no item-level splits).
 */
export async function saveReceipt(
  items: ReceiptItem[],
  userId: string,
  store?: string,
  date?: string
): Promise<IReceipt> {
  const receipt = new Receipt({
    userId,
    items: items.map((item) => ({ ...item, isSplit: false })),
    store,
    date: date ? new Date(date) : new Date(),
  });

  receipt.calculateTotal();
  return receipt.save();
}

/**
 * Save a receipt whose items may already carry per-user split information.
 */
export async function saveReceiptWithSplits(
  items: ReceiptItem[],
  store?: string,
  date?: string
): Promise<IReceipt> {
  const receipt = new Receipt({
    items,
    store,
    date: date ? new Date(date) : new Date(),
  });

  receipt.calculateTotal();
  return receipt.save();
}

/**
 * Apply a split configuration to specific items within an already-saved receipt.
 */
export async function applyItemSplits(
  receiptId: string,
  itemIndices: number[],
  splitConfig: SplitConfig
): Promise<IReceipt | null> {
  const receipt = await Receipt.findById(receiptId);
  if (!receipt) {
    throw new Error('Receipt not found');
  }

  itemIndices.forEach((index) => {
    if (index < 0 || index >= receipt.items.length) return;

    const item = receipt.items[index];
    const userSplits: { userId: string; amount: number; percentage: number }[] = [];

    if (splitConfig.type === 'equal') {
      // Divide evenly among all listed users
      const amountPerUser = item.price / splitConfig.userIds.length;
      const percentagePerUser = 100 / splitConfig.userIds.length;

      for (const userId of splitConfig.userIds) {
        userSplits.push({ userId, amount: amountPerUser, percentage: percentagePerUser });
      }
    } else if (splitConfig.type === 'percentage' && splitConfig.percentages) {
      // Each user gets a specified percentage
      for (const userId of splitConfig.userIds) {
        const percentage = splitConfig.percentages[userId] || 0;
        userSplits.push({ userId, amount: (item.price * percentage) / 100, percentage });
      }
    } else if (splitConfig.type === 'custom' && splitConfig.amounts) {
      // Each user gets a specified dollar amount; validate it sums correctly
      let totalAssigned = 0;
      for (const userId of splitConfig.userIds) {
        const amount = splitConfig.amounts[userId] || 0;
        totalAssigned += amount;
        userSplits.push({ userId, amount, percentage: (amount / item.price) * 100 });
      }

      if (Math.abs(totalAssigned - item.price) > 0.01) {
        throw new Error(
          `Total split amount (${totalAssigned}) does not match item price (${item.price})`
        );
      }
    }

    item.userSplits = userSplits;
    item.isSplit = true;
  });

  return receipt.save();
}

/**
 * Return all receipts that involve a given user (as primary owner or via splits).
 */
export async function getReceiptsByUser(userId: string): Promise<IReceipt[]> {
  return Receipt.findByUser(userId);
}

/**
 * Return a single receipt by its database ID, with user references populated.
 */
export async function getReceiptById(id: string): Promise<IReceipt | null> {
  return Receipt.findById(id).populate('userId').populate('userIds');
}

/**
 * Return a receipt enriched with per-user totals calculated from item splits.
 */
export async function getReceiptWithUserTotals(
  id: string
): Promise<ReceiptWithUserTotals | null> {
  const receipt = await Receipt.findById(id).populate('userId').populate('userIds');
  if (!receipt) return null;

  const userTotals = receipt.getUserSummary();

  return {
    _id: receipt.id,
    items: receipt.items,
    total: receipt.total,
    store: receipt.store,
    date: receipt.date,
    userTotals,
    userIds: receipt.userIds?.map((id) => id.toString()) || [],
  };
}

/**
 * Permanently delete a receipt by its database ID.
 */
export async function deleteReceipt(id: string): Promise<void> {
  await Receipt.findByIdAndDelete(id);
}

/**
 * Sum every receipt's contribution for a given user across the entire database.
 */
export async function getUserTotalFromAllReceipts(userId: string): Promise<number> {
  const receipts = await getReceiptsByUser(userId);
  return receipts.reduce((total, receipt) => total + receipt.calculateUserTotal(userId), 0);
}

/**
 * Build a map of userId → total amount owed across all receipts.
 */
export async function getReceiptsSummaryByUser(): Promise<{ [userId: string]: number }> {
  const allReceipts = await Receipt.find({}).populate('userId').populate('userIds');
  const summary: { [userId: string]: number } = {};

  allReceipts.forEach((receipt) => {
    const userSummary = receipt.getUserSummary();
    Object.entries(userSummary).forEach(([userId, amount]) => {
      summary[userId] = (summary[userId] || 0) + amount;
    });
  });

  return summary;
}
