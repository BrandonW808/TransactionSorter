import TranslationMapping, { ITranslationMapping } from '../models/TranslationMapping.model';
import Receipt, { IReceipt, IReceiptItem, ReceiptItem } from '../models/Receipt.model';

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

async function translateText(raw: string): Promise<string> {
    try {
        // First check if we have a translation in the database
        const mapping = await TranslationMapping.findOne({ original: raw });
        if (mapping) {
            await mapping.incrementUsage();
            return mapping.translation;
        }
    } catch (error) {
        console.error('Error looking up translation:', error);
    }

    // If no translation found, use the default transformation
    return makeHumanReadable(raw);
}

function makeHumanReadable(raw: string): string {
    // Remove price if present
    const match = raw.match(/^(.+?)\s+(-?\d+\.\d{2})$/);
    if (match) {
        const [, rawDescription, priceStr] = match;
        raw = rawDescription;
    }

    // Basic transformation rules
    let result = raw
        .replace(/\./g, " ")
        .replace(/\s+/g, " ")
        .trim();

    // Common French to English translations
    const translations: { [key: string]: string } = {
        'PAIN': 'Bread',
        'GRIL': 'Grilled',
        'AI': 'Garlic',
        'SELECTION': 'Selection',
        'EPICE': 'Spices',
        'LEG.C': 'Canned Vegetables',
        'RABAIS': 'Discount',
        'BAG': 'Baguette',
        'POULET': 'Chicken',
        'BOEUF': 'Beef',
        'PORC': 'Pork',
        'LAIT': 'Milk',
        'FROMAGE': 'Cheese',
        'BEURRE': 'Butter',
        'OEUF': 'Egg',
        'OEUFS': 'Eggs',
        'TOMATE': 'Tomato',
        'TOMATES': 'Tomatoes',
        'POMME': 'Apple',
        'POMMES': 'Apples',
        'ORANGE': 'Orange',
        'BANANE': 'Banana',
        'BANANES': 'Bananas',
        'CAROTTE': 'Carrot',
        'CAROTTES': 'Carrots',
        'SALADE': 'Salad',
        'RIZ': 'Rice',
        'PATES': 'Pasta',
        'HUILE': 'Oil',
        'SEL': 'Salt',
        'POIVRE': 'Pepper',
        'SUCRE': 'Sugar',
        'FARINE': 'Flour',
        'CAFE': 'Coffee',
        'THE': 'Tea',
        'JUS': 'Juice',
        'EAU': 'Water',
        'GLACE': 'Ice Cream',
        'CHOCOLAT': 'Chocolate',
        'BISCUIT': 'Cookie',
        'BISCUITS': 'Cookies',
        'GATEAU': 'Cake',
        'VIANDE': 'Meat',
        'POISSON': 'Fish',
        'FRUITS': 'Fruits',
        'FRUIT': 'Fruit',
        'LEGUMES': 'Vegetables',
        'LEGUME': 'Vegetable',
        'SURGELE': 'Frozen',
        'FRAIS': 'Fresh',
        'BIO': 'Organic',
        'SANS': 'Without',
        'AVEC': 'With',
        'ROUGE': 'Red',
        'BLANC': 'White',
        'VERT': 'Green',
        'JAUNE': 'Yellow',
        'NOIR': 'Black',
        'TOFU': 'Tofu',
        'ET': 'And',
        'M-ET': 'And',
        'EXT': 'Extra',
        'FE': 'Iron'
    };

    // Apply word-by-word translations
    const words = result.split(' ');
    const translatedWords = words.map(word => {
        const upperWord = word.toUpperCase();
        return translations[upperWord] || word;
    });

    result = translatedWords.join(' ');

    // Capitalize first letter of each word
    result = result.replace(/\b\w/g, l => l.toUpperCase());

    return result;
}

// Service functions for translation mappings
export async function getAllTranslations(): Promise<ITranslationMapping[]> {
    return TranslationMapping.find().sort({ usageCount: -1, original: 1 });
}

export async function addTranslation(
    original: string,
    translation: string,
    userId?: string
): Promise<ITranslationMapping> {
    const existing = await TranslationMapping.findOne({ original });
    if (existing) {
        existing.translation = translation;
        if (userId) existing.userId = userId;
        return existing.save();
    }

    return TranslationMapping.create({
        original,
        translation,
        userId,
        usageCount: 0
    });
}

export async function updateTranslation(
    id: string,
    translation: string
): Promise<ITranslationMapping | null> {
    return TranslationMapping.findByIdAndUpdate(
        id,
        { translation },
        { new: true }
    );
}

export async function deleteTranslation(id: string): Promise<boolean> {
    const result = await TranslationMapping.findByIdAndDelete(id);
    return !!result;
}

export async function getTranslation(text: string): Promise<ITranslationMapping | null> {
    const mapping = await TranslationMapping.findOne({ original: text });
    if (mapping) {
        await mapping.incrementUsage();
        return mapping;
    }
    return null;
}

// Service functions for receipts
export async function saveReceipt(
    items: IReceiptItem[],
    userId?: string,
    store?: string
): Promise<IReceipt> {
    const receipt = new Receipt({
        items,
        userId,
        store,
        total: 0,
        date: new Date()
    });

    receipt.calculateTotal();
    return receipt.save();
}

export async function getReceiptsByUser(userId: string): Promise<IReceipt[]> {
    return Receipt.findByUser(userId);
}

export async function getReceiptById(id: string): Promise<IReceipt | null> {
    return Receipt.findById(id);
}

export async function deleteReceipt(id: string): Promise<boolean> {
    const result = await Receipt.findByIdAndDelete(id);
    return !!result;
}
