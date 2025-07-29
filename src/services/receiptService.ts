
export function parseReceiptCSV(csv: string): ReceiptItem[] {
    const lines = csv.trim().split("\n");
    const header = lines[0].trim();
    const colIndex = header.split(",").indexOf("EPICERIE");

    if (colIndex === -1) throw new Error("Column 'EPICERIE' not found.");

    const itemLines = lines.slice(1).map(line => {
        const parts = line.split(",");
        return parts[colIndex].trim();
    });

    return parseReceiptLines(itemLines);
}

export function parseReceiptLines(lines: string[]): ReceiptItem[] {
    const items: ReceiptItem[] = [];

    for (const line of lines) {
        const trimmed = line.trim();

        const match = trimmed.match(/^(.+?)\s+(-?\d+\.\d{2})$/);
        if (match) {
            const [, rawDescription, priceStr] = match;
            const price = parseFloat(priceStr);

            const readableDescription = makeHumanReadable(rawDescription);

            items.push({
                originalText: trimmed,
                readableDescription,
                price,
            });
        }
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