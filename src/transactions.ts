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
  const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();

  const output: OutputRow[] = [];
  const categorized: {
    [mainCategory: string]: {
      [subCategory: string]: { desc: string; amount: number }[];
    };
  } = {};

  for (const txn of transactions) {
    const description = normalize(`${txn.subDescription ?? ""} ${txn.description ?? ""}`);
    let matched = false;

    // Handle special case for virgin plus
    if (txn.subDescription.toLowerCase().includes('virgin plus') && txn.amount == -153.34) {
      let mainCat = "Expenses";
      let subCat = "Living Expenses";
      if (!categorized[mainCat]) categorized[mainCat] = {};
      if (!categorized[mainCat][subCat]) categorized[mainCat][subCat] = [];
      categorized["Expenses"]["Living Expenses"].push({ desc: `Internet + TV`, amount: -60.16 });

      mainCat = "Expenses";
      subCat = "Phone Bill";
      if (!categorized[mainCat]) categorized[mainCat] = {};
      if (!categorized[mainCat][subCat]) categorized[mainCat][subCat] = [];
      categorized["Expenses"]["Phone Bill"].push({ desc: `Phone Bill`, amount: (txn.amount + 60.16) });
      matched = true;
    } else {
      // Normal categorization
      for (const [mainCat, subCats] of Object.entries(categories)) {
        for (const [subCat, keywords] of Object.entries(subCats)) {
          if (keywords.some(keyword => description.includes(normalize(keyword)))) {
            if (!categorized[mainCat]) categorized[mainCat] = {};
            if (!categorized[mainCat][subCat]) categorized[mainCat][subCat] = [];

            categorized[mainCat][subCat].push({
              desc: `${txn.description} ${txn.subDescription}`,
              amount: txn.amount
            });

            matched = true;
            break;
          }
        }
        if (matched) break;
      }
    }

    // Handle unmatched transactions
    if (!matched) {
      if (txn.description.includes("date=")) {
        continue;
      }

      if (autoAssignUnknown) {
        // Auto-assign to "Misc Spending" if not matched
        const mainCat = "Expenses";
        const subCat = "Misc Spending";
        if (!categorized[mainCat]) categorized[mainCat] = {};
        if (!categorized[mainCat][subCat]) categorized[mainCat][subCat] = [];
        categorized[mainCat][subCat].push({
          desc: `${txn.description} ${txn.subDescription}`,
          amount: txn.amount
        });
      }
    }
  }

  // Build output format
  const expenseCategories = categories.Expenses ? Object.keys(categories.Expenses) : [];
  const headerRow1: OutputRow = ["Expenses"];
  const headerRow2: OutputRow = [""];

  for (const sub of expenseCategories) {
    headerRow1.push(sub, "");
    headerRow2.push("Description", "Amount");
  }

  output.push(headerRow1);
  output.push(headerRow2);

  const maxRows = Math.max(...expenseCategories.map(sub => categorized.Expenses?.[sub]?.length || 0));

  for (let i = 0; i < maxRows; i++) {
    const row: OutputRow = [""];
    for (const sub of expenseCategories) {
      const entry = categorized.Expenses?.[sub]?.[i];
      row.push(entry?.desc ?? "", entry ? `$ ${entry.amount.toFixed(2)}` : "");
    }
    output.push(row);
  }

  // Totals row
  const totalRow: OutputRow = ["Total"];
  for (const sub of expenseCategories) {
    const total = (categorized.Expenses?.[sub] || []).reduce((sum, entry) => sum + entry.amount, 0);
    totalRow.push("", total ? `$ ${total.toFixed(2)}` : "$ -");
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
