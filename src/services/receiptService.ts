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

    for (const line of lines) {
        const trimmed = line.trim();

        const match = trimmed.match(/^(.+?)\s+(-?\d+\.\d{2})$/);
        if (match) {
            const [, rawDescription, priceStr] = match;
            const price = parseFloat(priceStr);

            // Try to find existing translation
            const readableDescription = await translateText(trimmed);

            items.push({
                originalText: trimmed,
                readableDescription,
                price,
            });
        }
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
    const match = raw.match(/^(.+?)\s+(-?\d+\.\d{2})$/);
    if (match) {
        const [, rawDescription, priceStr] = match;
        const price = parseFloat(priceStr);
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
        'LEGUMES': 'Vegetables',
        'SURGELE': 'Frozen',
        'FRAIS': 'Fresh',
        'BIO': 'Organic',
        'SANS': 'Without',
        'AVEC': 'With',
        'ROUGE': 'Red',
        'BLANC': 'White',
        'VERT': 'Green',
        'JAUNE': 'Yellow',
        'NOIR': 'Black'
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
