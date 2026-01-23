import { Transaction, Categories, SharedTransaction, TransactionWithReceipt } from "./types";
import { ISplitEntry } from "./models/TransactionSplit.model";

export type OutputRow = (string | number)[];

interface CategorizedEntry {
  desc: string;
  amount: number;
  hasReceipt?: boolean;
  originalAmount?: number;
  splitInfo?: string;
  userId?: string;
}

interface CategorizedData {
  [mainCategory: string]: {
    [subCategory: string]: CategorizedEntry[];
  };
}

const normalize = (s: string): string =>
  s.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();

/**
 * Categorizes transactions with support for multi-category splits and user filtering
 */
export function categorizeTransactionsAdvanced(
  transactions: any[],
  categories: Categories,
  options: {
    userId?: string;
    applyUserSplits?: boolean;
    applyCategorySplits?: boolean;
    autoAssignUnknown?: boolean;
  } = {}
): OutputRow[] {
  const { userId, applyUserSplits = true, applyCategorySplits = true, autoAssignUnknown = true } = options;

  const categorized: CategorizedData = {};

  for (const txn of transactions) {
    const transactionId = txn.transactionId || '';
    const hasSplit = txn.hasSplit && txn.splits && txn.splits.length > 0;
    const splitType = txn.splitType || 'user';

    // Handle transactions with category splits
    if (hasSplit && applyCategorySplits && (splitType === 'category' || splitType === 'combined')) {
      processCategorySplits(txn, categorized, userId, applyUserSplits);
      continue;
    }

    // Handle transactions with user-only splits
    if (hasSplit && applyUserSplits && splitType === 'user') {
      processUserSplits(txn, categorized, categories, userId, autoAssignUnknown);
      continue;
    }

    // Handle regular transactions (no splits or splits not applied)
    processRegularTransaction(txn, categorized, categories, autoAssignUnknown);
  }

  return buildOutputFromCategorized(categorized);
}

function processCategorySplits(
  txn: any,
  categorized: CategorizedData,
  userId?: string,
  applyUserSplits: boolean = true
): void {
  for (const split of txn.splits) {
    // If filtering by user and this split isn't for the user, skip
    if (userId && applyUserSplits && split.userId && split.userId !== userId) {
      continue;
    }

    const mainCat = split.mainCategory || 'Uncategorized';
    const subCat = split.subCategory || 'Unknown';

    if (!categorized[mainCat]) categorized[mainCat] = {};
    if (!categorized[mainCat][subCat]) categorized[mainCat][subCat] = [];

    let description = split.description || txn.description || '';
    if (txn.subDescription) {
      description = `${description} ${txn.subDescription}`.trim();
    }

    // Add split info to description
    if (split.userName) {
      description += ` (${split.userName})`;
    }

    categorized[mainCat][subCat].push({
      desc: description,
      amount: split.amount,
      splitInfo: split.userName || undefined,
      userId: split.userId
    });
  }
}

function processUserSplits(
  txn: any,
  categorized: CategorizedData,
  categories: Categories,
  userId?: string,
  autoAssignUnknown: boolean = true
): void {
  const description = normalize(`${txn.subDescription ?? ""} ${txn.description ?? ""}`);

  // Find the category for this transaction
  let matchedMain: string | null = null;
  let matchedSub: string | null = null;

  for (const [mainCat, subCats] of Object.entries(categories)) {
    for (const [subCat, keywords] of Object.entries(subCats)) {
      if (keywords.some(keyword => description.includes(normalize(keyword)))) {
        matchedMain = mainCat;
        matchedSub = subCat;
        break;
      }
    }
    if (matchedMain) break;
  }

  if (!matchedMain && autoAssignUnknown) {
    matchedMain = 'Uncategorized';
    matchedSub = 'Unknown';
  }

  if (!matchedMain || !matchedSub) return;

  // Process each user split
  for (const split of txn.splits) {
    // If filtering by user, only include their portion
    if (userId && split.userId !== userId) {
      continue;
    }

    if (!categorized[matchedMain]) categorized[matchedMain] = {};
    if (!categorized[matchedMain][matchedSub]) categorized[matchedMain][matchedSub] = [];

    let desc = `${txn.description ?? ""} ${txn.subDescription ?? ""}`.trim();
    if (split.userName) {
      desc += ` (${split.userName} - ${split.percentage?.toFixed(0)}%)`;
    }

    categorized[matchedMain][matchedSub].push({
      desc,
      amount: split.amount,
      splitInfo: split.userName,
      userId: split.userId
    });
  }
}

function processRegularTransaction(
  txn: any,
  categorized: CategorizedData,
  categories: Categories,
  autoAssignUnknown: boolean = true
): void {
  const description = normalize(`${txn.subDescription ?? ""} ${txn.description ?? ""}`);
  const amount = txn.adjustedAmount ?? txn.amount;
  const hasReceipt = !!txn.matchedReceipt;

  let matched = false;

  // Special case for Virgin Plus
  if (txn.subDescription?.toLowerCase().includes("virgin plus") && Math.abs(txn.amount) === 153.34) {
    addToCategory(categorized, "Housing", "Utilities", "Internet + TV", -60.16, hasReceipt);
    addToCategory(categorized, "Housing", "Utilities", "Phone Bill", txn.amount + 60.16, hasReceipt);
    return;
  }

  for (const [mainCat, subCats] of Object.entries(categories)) {
    for (const [subCat, keywords] of Object.entries(subCats)) {
      if (keywords.some(keyword => description.includes(normalize(keyword)))) {
        let descText = `${txn.description ?? ""} ${txn.subDescription ?? ""}`.trim();
        if (hasReceipt) descText += " 🧾";

        addToCategory(categorized, mainCat, subCat, descText, amount, hasReceipt, txn.originalAmount);
        matched = true;
        break;
      }
    }
    if (matched) break;
  }

  if (!matched && autoAssignUnknown) {
    let descText = `${txn.description ?? ""} ${txn.subDescription ?? ""}`.trim();
    if (hasReceipt) descText += " 🧾";

    addToCategory(categorized, "Uncategorized", "Unknown", descText, amount, hasReceipt, txn.originalAmount);
  }
}

function addToCategory(
  categorized: CategorizedData,
  mainCat: string,
  subCat: string,
  desc: string,
  amount: number,
  hasReceipt: boolean = false,
  originalAmount?: number
): void {
  if (!categorized[mainCat]) categorized[mainCat] = {};
  if (!categorized[mainCat][subCat]) categorized[mainCat][subCat] = [];

  categorized[mainCat][subCat].push({
    desc,
    amount,
    hasReceipt,
    originalAmount
  });
}

function buildOutputFromCategorized(categorized: CategorizedData): OutputRow[] {
  const output: OutputRow[] = [];

  // Build headers
  const headerRow1: OutputRow = ["Category"];
  const headerRow2: OutputRow = [""];
  const columnOrder: { main: string; sub: string }[] = [];

  for (const [mainCat, subCats] of Object.entries(categorized)) {
    for (const subCat of Object.keys(subCats)) {
      headerRow1.push(`${mainCat} → ${subCat}`, "");
      headerRow2.push("Description", "Amount");
      columnOrder.push({ main: mainCat, sub: subCat });
    }
  }

  output.push(headerRow1);
  output.push(headerRow2);

  // Determine max rows
  const maxRows = Math.max(
    ...columnOrder.map(({ main, sub }) => categorized[main][sub].length),
    0
  );

  for (let i = 0; i < maxRows; i++) {
    const row: OutputRow = [""];
    for (const { main, sub } of columnOrder) {
      const entry = categorized[main][sub][i];
      row.push(entry?.desc ?? "", entry ? `$ ${entry.amount.toFixed(2)}` : "");
    }
    output.push(row);
  }

  // Add totals row
  const totalRow: OutputRow = ["Total"];
  for (const { main, sub } of columnOrder) {
    const total = categorized[main][sub].reduce((sum, entry) => sum + entry.amount, 0);
    totalRow.push("", `$ ${total.toFixed(2)}`);
  }
  output.push(totalRow);

  return output;
}

// Keep existing functions for backward compatibility
export function categorizeTransactions(
  transactions: Transaction[],
  categories: Categories,
  autoAssignUnknown: boolean = true
): OutputRow[] {
  return categorizeTransactionsAdvanced(transactions, categories, { autoAssignUnknown });
}

export function categorizeTransactionsWithReceipts(
  transactions: TransactionWithReceipt[],
  categories: Categories,
  autoAssignUnknown: boolean = true
): OutputRow[] {
  return categorizeTransactionsAdvanced(transactions, categories, { autoAssignUnknown });
}

export function categorizeTransactionsWithSplits(
  transactions: any[],
  categories: Categories,
  userId?: string
): OutputRow[] {
  return categorizeTransactionsAdvanced(transactions, categories, {
    userId,
    applyUserSplits: true,
    applyCategorySplits: true,
    autoAssignUnknown: true
  });
}

export function categorizeTransactionsForUser(
  transactions: any[],
  categories: Categories,
  userId: string
): OutputRow[] {
  return categorizeTransactionsAdvanced(transactions, categories, {
    userId,
    applyUserSplits: true,
    applyCategorySplits: true,
    autoAssignUnknown: true
  });
}

export function processSharedTransactions(
  output: OutputRow[],
  shared: SharedTransaction[]
): OutputRow[] {
  const headerRow = output[0];
  const subcategoryIndexMap: { [subcategory: string]: number } = {};

  for (let i = 1; i < headerRow.length; i += 2) {
    const subcat = headerRow[i];
    if (typeof subcat === "string") {
      subcategoryIndexMap[subcat.toLowerCase()] = i;
    }
  }

  const bodyRows = output.slice(2, -1);

  for (const sharedTxn of shared) {
    const { description, total, brandon, expense } = sharedTxn;
    let matched = false;

    for (const row of bodyRows) {
      for (let i = 2; i < row.length; i += 2) {
        const cell = row[i];
        const amount = typeof cell === "string" ? parseFloat(cell.replace(/[^\d.-]+/g, "")) : NaN;
        if (!isNaN(amount) && Math.abs(amount - total) < 0.01) {
          row[i - 1] = description;
          row[i] = `$ ${brandon.toFixed(2)}`;
          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    if (!matched) {
      const lowerExpense = expense.toLowerCase();
      const matchedSubcat = Object.entries(subcategoryIndexMap).find(([subcat]) => subcat === lowerExpense);
      const targetIndex = matchedSubcat ? matchedSubcat[1] : 1;

      const newRow: OutputRow = [""];
      for (let i = 1; i < headerRow.length; i += 2) {
        if (i === targetIndex) {
          newRow.push(description, `$ ${brandon.toFixed(2)}`);
        } else {
          newRow.push("", "");
        }
      }
      output.splice(output.length - 1, 0, newRow);
    }
  }

  return output;
}