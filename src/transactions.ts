import { Transaction, Categories, SharedTransaction } from "./types";

export type OutputRow = (string | number)[];

/**
 * Categorizes a list of transactions based on keyword rules.
 * Returns rows structured like the output spreadsheet.
 */
export function categorizeTransactions(
  transactions: Transaction[],
  categories: Categories,
  autoAssignUnknown: boolean = true
): OutputRow[] {
  const normalize = (s: string): string =>
    s.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();

  const output: OutputRow[] = [];
  const categorized: {
    [mainCategory: string]: {
      [subCategory: string]: { desc: string; amount: number }[];
    };
  } = {};

  for (const txn of transactions) {
    const description = normalize(`${txn.subDescription ?? ""} ${txn.description ?? ""}`);
    let matched = false;

    // Special case for Virgin Plus
    if (
      txn.subDescription?.toLowerCase().includes("virgin plus") &&
      txn.amount === -153.34
    ) {
      const addToCategory = (main: string, sub: string, desc: string, amount: number) => {
        if (!categorized[main]) categorized[main] = {};
        if (!categorized[main][sub]) categorized[main][sub] = [];
        categorized[main][sub].push({ desc, amount });
      };

      addToCategory("Housing", "Utilities", "Internet + TV", -60.16);
      addToCategory("Housing", "Utilities", "Phone Bill", txn.amount + 60.16);
      matched = true;
      continue;
    }

    // Try to match against categories
    for (const [mainCat, subCats] of Object.entries(categories)) {
      for (const [subCat, keywords] of Object.entries(subCats)) {
        if (keywords.some(keyword => description.includes(normalize(keyword)))) {
          if (!categorized[mainCat]) categorized[mainCat] = {};
          if (!categorized[mainCat][subCat]) categorized[mainCat][subCat] = [];

          categorized[mainCat][subCat].push({
            desc: `${txn.description ?? ""} ${txn.subDescription ?? ""}`.trim(),
            amount: txn.amount
          });

          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    // Unmatched fallback
    if (!matched && autoAssignUnknown) {
      const mainCat = "Uncategorized";
      const subCat = "Misc Spending";
      if (!categorized[mainCat]) categorized[mainCat] = {};
      if (!categorized[mainCat][subCat]) categorized[mainCat][subCat] = [];

      categorized[mainCat][subCat].push({
        desc: `${txn.description ?? ""} ${txn.subDescription ?? ""}`.trim(),
        amount: txn.amount
      });
    }
  }

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

  // Determine max number of rows
  const maxRows = Math.max(
    ...columnOrder.map(({ main, sub }) => categorized[main][sub].length)
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

export function processSharedTransactions(
  output: OutputRow[],
  shared: SharedTransaction[]
): OutputRow[] {
  const headerRow = output[0];
  const subcategoryIndexMap: { [subcategory: string]: number } = {};

  // Build map from subcategory name to column index
  for (let i = 1; i < headerRow.length; i += 2) {
    const subcat = headerRow[i];
    if (typeof subcat === "string") {
      subcategoryIndexMap[subcat.toLowerCase()] = i;
    }
  }

  const bodyRows = output.slice(2, -1); // Skip headers and totals

  for (const sharedTxn of shared) {
    const { description, total, brandon, expense } = sharedTxn;
    let matched = false;

    // Try to match by amount
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

    // If not matched, add as new row
    if (!matched) {
      const lowerExpense = expense.toLowerCase();
      const matchedSubcat = Object.entries(subcategoryIndexMap).find(([subcat]) => subcat === lowerExpense);
      const targetIndex = matchedSubcat ? matchedSubcat[1] : 1; // default to 1 if none matched

      const newRow: OutputRow = [""];
      for (let i = 1; i < headerRow.length; i += 2) {
        if (i === targetIndex) {
          newRow.push(description, `$ ${brandon.toFixed(2)}`);
        } else {
          newRow.push("", "");
        }
      }
      output.splice(output.length - 1, 0, newRow); // Insert before totals
    }
  }

  return output;
}
