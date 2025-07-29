import { Transaction, SharedTransaction } from "./types";

export function parseTransactionCSV(csvText: string): Transaction[] {
    const lines = csvText.split("\n").map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) {
        throw new Error("CSV file is empty");
    }
    
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const transactions: Transaction[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(val => val.trim().replace(/^"|"$/g, ""));

        const row: Record<string, string> = {};
        headers.forEach((key, index) => {
            row[key] = values[index] ?? "";
        });

        const transaction: Transaction = {
            date: row["date"] || "",
            description: row["description"] || "",
            subDescription: row["sub-description"] || "",
            type: row["type of transaction"] || "",
            amount: parseFloat(row["amount"]) || 0,
            balance: parseFloat(row["balance"]) || undefined
        };

        transactions.push(transaction);
    }

    return transactions;
}

export function parseSharedCsv(csvText: string): SharedTransaction[] {
    const lines = csvText.trim().split("\n");
    if (lines.length <= 1) {
        return [];
    }
    
    const [headerLine, ...rows] = lines;

    return rows.map(line => {
        const [date, expense, description, total, brandon] = line.split(",").map(s => s.trim());
        return {
            description: description || "",
            total: parseFloat(total) || 0,
            brandon: parseFloat(brandon) || 0,
            expense: (expense || "").toLowerCase()
        };
    });
}

export function parseMultipleFiles(files: { transactions?: string; shared?: string }): { transactions: Transaction[]; shared: SharedTransaction[] } {
    const transactions = files.transactions ? parseTransactionCSV(files.transactions) : [];
    const shared = files.shared ? parseSharedCsv(files.shared) : [];
    
    return { transactions, shared };
}
