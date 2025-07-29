type ReceiptItem = {
    originalText: string;
    readableDescription: string;
    price: number;
};

function parseReceiptLines(lines: string[]): ReceiptItem[] {
    const items: ReceiptItem[] = [];

    for (const line of lines) {
        const trimmed = line.trim();

        // Match item with price at end, e.g., "BAG.PAIN GRIL.AI 2.99"
        const itemWithPriceMatch = trimmed.match(/^(.+?)\s+(-?\d+\.\d{2})$/);
        if (itemWithPriceMatch) {
            const [, rawDescription, priceStr] = itemWithPriceMatch;
            const price = parseFloat(priceStr);

            const readableDescription = makeHumanReadable(rawDescription);

            items.push({
                originalText: trimmed,
                readableDescription,
                price,
            });

            continue;
        }

        // Skip lines that don't match any expected format
    }

    return items;
}

function makeHumanReadable(raw: string): string {
    return raw
        .replace(/\./g, " ")
        .replace(/\bPAIN\b/, "Bread")
        .replace(/\bGRIL\b/, "Grilled")
        .replace(/\bAI\b/, "Garlic")
        .replace(/\bSELECTION\b/, "Selection")
        .replace(/\bEPICE\b/, "Spices")
        .replace(/\bLEG\.C\b/, "Canned Vegetables")
        .replace(/\bRABAIS\b/, "Discount")
        .trim();
}

// Example usage:
const lines = [
    "BAG.PAIN GRIL.AI 2.99",
    "Rabais 0.80",
    "SELECTION EPICE 1.99",
    "SELECTION LEG.C 1.49",
    "(1.49@30.00%) -0.45"
];
