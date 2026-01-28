import Tesseract from 'tesseract.js';
import sharp from 'sharp';

interface OCRResult {
    text: string;
    confidence: number;
}

/**
 * Preprocess image for better OCR results
 */
async function preprocessImage(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
        .resize(2000, null, { // Resize to reasonable width
            withoutEnlargement: true,
            fit: 'inside'
        })
        .grayscale() // Convert to grayscale
        .normalize() // Normalize contrast
        .sharpen() // Sharpen edges
        .toBuffer();
}

/**
 * Extract text from image using Tesseract OCR
 */
export async function extractTextFromImage(
    imageBuffer: Buffer,
    language: string = 'eng+fra'
): Promise<OCRResult> {
    try {
        // Preprocess image
        const processedBuffer = await preprocessImage(imageBuffer);

        // Perform OCR
        const { data } = await Tesseract.recognize(
            processedBuffer,
            language,
            {
                logger: (m) => console.log('OCR Progress:', m)
            }
        );

        return {
            text: data.text,
            confidence: data.confidence
        };
    } catch (error) {
        throw new Error(`OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Parse receipt text into structured format
 */
export function parseReceiptText(text: string): {
    items: Array<{ description: string; price: number; quantity?: number }>;
    total?: number;
    date?: string;
    store?: string;
} {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    const items: Array<{ description: string; price: number; quantity?: number }> = [];
    let total: number | undefined;
    let date: string | undefined;
    let store: string | undefined;

    // Try to find store name (usually in first few lines)
    if (lines.length > 0) {
        store = lines[0];
    }

    // Date patterns
    const datePattern = /\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2})\b/;

    for (const line of lines) {
        const dateMatch = line.match(datePattern);
        if (dateMatch) {
            date = dateMatch[0];
        }

        // Price patterns: $XX.XX or XX.XX at end of line
        const pricePattern = /\$?\s*(\d+\.\d{2})\s*$/;
        const match = line.match(pricePattern);

        if (match) {
            const price = parseFloat(match[1]);

            // Check if this is a total line
            const lowerLine = line.toLowerCase();
            if (
                lowerLine.includes('total') ||
                lowerLine.includes('balance') ||
                lowerLine.includes('amount due')
            ) {
                total = price;
                continue;
            }

            // Check if this is a subtotal or tax line (skip)
            if (
                lowerLine.includes('subtotal') ||
                lowerLine.includes('tax') ||
                lowerLine.includes('gst') ||
                lowerLine.includes('pst') ||
                lowerLine.includes('hst')
            ) {
                continue;
            }

            // Extract description (everything before the price)
            const description = line.substring(0, match.index).trim();

            if (description) {
                // Check for quantity (pattern: number followed by @ or x)
                const qtyPattern = /^(\d+)\s*[@xX]\s*/;
                const qtyMatch = description.match(qtyPattern);

                const item: { description: string; price: number; quantity?: number } = {
                    description: qtyMatch
                        ? description.substring(qtyMatch[0].length).trim()
                        : description,
                    price
                };

                if (qtyMatch) {
                    item.quantity = parseInt(qtyMatch[1]);
                }

                items.push(item);
            }
        }
    }

    return { items, total, date, store };
}

/**
 * Convert parsed receipt to CSV format
 */
export function receiptToCSV(parsed: ReturnType<typeof parseReceiptText>): string {
    const rows: string[][] = [
        ['EPICERIE'] // Header matching your existing format
    ];

    parsed.items.forEach(item => {
        const description = item.quantity
            ? `${item.description} ${item.quantity}@`
            : item.description;

        rows.push([description]);
        rows.push([item.price.toFixed(2)]);
    });

    return rows.map(row => row.join(',')).join('\n');
}