import TranslationMapping, { ITranslationMapping } from '../models/TranslationMapping.model';
import Receipt, { IReceipt, IReceiptItem, ReceiptItem } from '../models/Receipt.model';
import { SplitConfig, ReceiptWithUserTotals } from '../types';

export async function parseReceiptCSV(csv: string): Promise<ReceiptItem[]> {
    const lines = csv.trim().split("\n");
    const header = lines[0].trim();
    const colIndex = header.split(",").indexOf("EPICERIE");

    if (colIndex === -1) throw new Error("Column 'EPICERIE' not found.");

    const itemLines = lines.slice(1).map(line => {
        const parts = line.split(",");
        return parts[colIndex].trim();
    });

    return await parseReceiptLines(itemLines);
}

export async function parseReceiptLines(lines: string[]): Promise<ReceiptItem[]> {
    const items: ReceiptItem[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i].trim();

        if (!line) {
            i++;
            continue;
        }

        // Check if this line is a price line only (matching pattern like "2 @ $2.99 5.98")
        const priceOnlyMatch = line.match(/^(\d+)\s*@\s*\$?(\d+\.\d{2})\s+(-?\d+\.\d{2})$/);
        if (priceOnlyMatch) {
            // This is a quantity @ unit price total line
            // Look back to find the item name
            let itemName = "";
            let lookBack = i - 1;

            while (lookBack >= 0 && lines[lookBack].trim()) {
                const prevLine = lines[lookBack].trim();
                // Check if previous line is NOT a price line
                if (!prevLine.match(/\d+\.\d{2}$/) && !prevLine.match(/^(\d+)\s*@/)) {
                    itemName = prevLine;
                    break;
                }
                lookBack--;
            }

            if (itemName) {
                const [, quantity, unitPrice, totalPrice] = priceOnlyMatch;

                const price = parseFloat(totalPrice);

                const fullText = `${itemName} ${line}`;
                const readableDescription = await translateText(itemName) + ` (${quantity} @ $${unitPrice})`;

                items.push({
                    originalText: fullText,
                    readableDescription,
                    price,
                });
            }
            i++;
            continue;
        }

        // Check if this line ends with a price
        const lineWithPriceMatch = line.match(/^(.+?)\s+(-?\d+\.\d{2})$/);
        if (lineWithPriceMatch) {
            const [, rawDescription, priceStr] = lineWithPriceMatch;

            const price = parseFloat(priceStr);

            // Check if this is a discount line
            const isDiscount = rawDescription.toUpperCase().includes('RABAIS') ||
                rawDescription.toUpperCase().includes('DISCOUNT') ||
                price < 0;

            if (isDiscount && items.length > 0) {
                // Apply discount to the previous item
                const lastItem = items[items.length - 1];
                if (price < 0) {
                    // Price is negative for discount
                    lastItem.price += price; // price is negative for discounts
                } else {
                    // Price is positive for discount
                    lastItem.price -= price; // price is negative for discounts
                }
                lastItem.readableDescription += ` (Discount: $${Math.abs(price)})`;
                lastItem.suffixText = line;
            } else {
                // Regular item with price
                const readableDescription = await translateText(line);
                items.push({
                    originalText: line,
                    readableDescription,
                    price,
                });
            }
            i++;
            continue;
        }

        // Check if the next line contains price information
        if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();

            // Check if next line is a quantity @ price line
            const quantityPriceMatch = nextLine.match(/^(\d+)\s*@\s*\$?(\d+\.\d{2})\s+(-?\d+\.\d{2})$/);
            if (quantityPriceMatch) {
                const [, quantity, unitPrice, totalPrice] = quantityPriceMatch;
                const price = parseFloat(totalPrice);
                console.log(`Quantity Price Match: ${price}`);
                const readableDescription = await translateText(line) + ` (${quantity} @ $${unitPrice})`;

                items.push({
                    originalText: line,
                    suffixText: nextLine,
                    readableDescription,
                    price,
                });
                i += 2; // Skip both lines
                continue;
            }

            // // Check if next line ends with a price
            const nextLineWithPrice = nextLine.match(/^(.+?)\s+(-?\d+\.\d{2})$/);
            if (nextLineWithPrice) {
                const [, , priceStr] = nextLineWithPrice;

                const price = parseFloat(priceStr);
                console.log(`Line: ${line} Next Line: ${nextLine}`);
                const readableDescription = await translateText(line);

                items.push({
                    originalText: line,
                    suffixText: nextLine,
                    readableDescription,
                    price,
                });
                i += 2; // Skip both lines
                continue;
            }
        }

        // Line doesn't have associated price information, skip it
        i++;
    }

    return items;
}

// Translation functions
export async function getAllTranslations(): Promise<ITranslationMapping[]> {
    return await TranslationMapping.find({});
}

export async function addTranslation(originalText: string, translatedText: string): Promise<ITranslationMapping> {
    const translation = new TranslationMapping({
        originalText: originalText.trim(),
        translatedText: translatedText.trim()
    });
    return await translation.save();
}

export async function updateTranslation(
    id: string,
    originalText: string,
    translatedText: string
): Promise<ITranslationMapping | null> {
    return await TranslationMapping.findByIdAndUpdate(
        id,
        {
            originalText: originalText.trim(),
            translatedText: translatedText.trim()
        },
        { new: true, runValidators: true }
    );
}

export async function deleteTranslation(id: string): Promise<void> {
    await TranslationMapping.findByIdAndDelete(id);
}

export async function getTranslation(text: string): Promise<string> {
    const mapping = await TranslationMapping.findOne({ originalText: text.trim() });
    return mapping?.translation || text;
}

export async function translateText(text: string): Promise<string> {
    return await getTranslation(text);
}

// Receipt saving functions
export async function saveReceipt(
    items: ReceiptItem[],
    userId: string,
    store?: string,
    date?: string
): Promise<IReceipt> {
    const receipt = new Receipt({
        userId,
        items: items.map(item => ({
            ...item,
            isSplit: false
        })),
        store,
        date: date ? new Date(date) : new Date()
    });

    receipt.calculateTotal();
    return await receipt.save();
}

// New function to save receipt with splits
export async function saveReceiptWithSplits(
    items: ReceiptItem[],
    store?: string,
    date?: string
): Promise<IReceipt> {
    const receipt = new Receipt({
        items,
        store,
        date: date ? new Date(date) : new Date()
    });

    receipt.calculateTotal();
    return await receipt.save();
}

// Apply splits to specific items in a receipt
export async function applyItemSplits(
    receiptId: string,
    itemIndices: number[],
    splitConfig: SplitConfig
): Promise<IReceipt | null> {
    const receipt = await Receipt.findById(receiptId);
    if (!receipt) {
        throw new Error('Receipt not found');
    }

    // Apply splits to specified items
    itemIndices.forEach(index => {
        if (index >= 0 && index < receipt.items.length) {
            const item = receipt.items[index];
            const userSplits = [];

            if (splitConfig.type === 'equal') {
                // Equal split among users
                const amountPerUser = item.price / splitConfig.userIds.length;
                const percentagePerUser = 100 / splitConfig.userIds.length;

                for (const userId of splitConfig.userIds) {
                    userSplits.push({
                        userId,
                        amount: amountPerUser,
                        percentage: percentagePerUser
                    });
                }
            } else if (splitConfig.type === 'percentage' && splitConfig.percentages) {
                // Percentage-based split
                for (const userId of splitConfig.userIds) {
                    const percentage = splitConfig.percentages[userId] || 0;
                    userSplits.push({
                        userId,
                        amount: (item.price * percentage) / 100,
                        percentage
                    });
                }
            } else if (splitConfig.type === 'custom' && splitConfig.amounts) {
                // Custom amount split
                let totalAssigned = 0;
                for (const userId of splitConfig.userIds) {
                    const amount = splitConfig.amounts[userId] || 0;
                    totalAssigned += amount;
                    userSplits.push({
                        userId,
                        amount,
                        percentage: (amount / item.price) * 100
                    });
                }

                // Validate that total assigned equals item price
                if (Math.abs(totalAssigned - item.price) > 0.01) {
                    throw new Error(`Total split amount (${totalAssigned}) does not match item price (${item.price})`);
                }
            }

            item.userSplits = userSplits;
            item.isSplit = true;
        }
    });

    return await receipt.save();
}

// Get receipts for a specific user (including split receipts)
export async function getReceiptsByUser(userId: string): Promise<IReceipt[]> {
    return await Receipt.findByUser(userId);
}

// Get receipt by ID
export async function getReceiptById(id: string): Promise<IReceipt | null> {
    return await Receipt.findById(id).populate('userId').populate('userIds');
}

// Get receipt with user totals calculated
export async function getReceiptWithUserTotals(id: string): Promise<ReceiptWithUserTotals | null> {
    const receipt = await Receipt.findById(id).populate('userId').populate('userIds');
    if (!receipt) {
        return null;
    }

    const userTotals = receipt.getUserSummary();

    return {
        _id: receipt.id,
        items: receipt.items,
        total: receipt.total,
        store: receipt.store,
        date: receipt.date,
        userTotals,
        userIds: receipt.userIds?.map(id => id.toString()) || []
    };
}

// Delete receipt
export async function deleteReceipt(id: string): Promise<void> {
    await Receipt.findByIdAndDelete(id);
}

// Get user's total from all receipts
export async function getUserTotalFromAllReceipts(userId: string): Promise<number> {
    const receipts = await getReceiptsByUser(userId);
    return receipts.reduce((total, receipt) => {
        return total + receipt.calculateUserTotal(userId);
    }, 0);
}

// Get summary of all receipts by user
export async function getReceiptsSummaryByUser(): Promise<{ [userId: string]: number }> {
    const allReceipts = await Receipt.find({}).populate('userId').populate('userIds');
    const summary: { [userId: string]: number } = {};

    allReceipts.forEach(receipt => {
        const userSummary = receipt.getUserSummary();
        Object.entries(userSummary).forEach(([userId, amount]) => {
            summary[userId] = (summary[userId] || 0) + amount;
        });
    });

    return summary;
}
