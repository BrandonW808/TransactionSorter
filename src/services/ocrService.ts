import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import { IReceiptFormat } from '../models/ReceiptFormat.model';
import { detectFormat, parseReceiptWithFormat, ParsedReceipt } from './receiptFormatService';

interface OCRResult {
  text: string;
  confidence: number;
}

/**
 * Preprocess an image buffer for better OCR accuracy.
 * Resizes to a reasonable width, converts to greyscale, normalises contrast,
 * and sharpens edges.
 */
async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(2000, null, {
      withoutEnlargement: true,
      fit: 'inside',
    })
    .grayscale()
    .normalize()
    .sharpen()
    .toBuffer();
}

/**
 * Run Tesseract OCR on the given image buffer and return the extracted text
 * together with Tesseract's own confidence score (0–100).
 */
export async function extractTextFromImage(
  imageBuffer: Buffer,
  language: string = 'eng+fra'
): Promise<OCRResult> {
  try {
    const processedBuffer = await preprocessImage(imageBuffer);

    const { data } = await Tesseract.recognize(processedBuffer, language, {
      logger: (m: { progress?: number }) =>
        console.log('OCR Progress:', m.progress),
    });

    return {
      text: data.text,
      confidence: data.confidence,
    };
  } catch (error) {
    throw new Error(
      `OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ---------------------------------------------------------------------------
// Format-aware receipt parsing
// ---------------------------------------------------------------------------

/**
 * Result returned by `parseReceiptText` when a format is used.
 * Wraps the format-level `ParsedReceipt` and adds the detected format metadata.
 */
export interface FormatAwareParseResult extends ParsedReceipt {
  /** The format that was applied (or auto-detected). */
  detectedFormat: {
    id: string;
    name: string;
    score: number;
  } | null;
}

/**
 * Parse raw OCR text into structured receipt data.
 *
 * Behaviour:
 *   • If an explicit `format` is supplied it is used directly.
 *   • Otherwise `detectFormat` is called to find the best-matching stored
 *     format from the database.
 *   • If *no* format matches (database is empty or all scores are zero) a
 *     built-in fallback parser runs so that basic receipts still work without
 *     any format definitions.
 *
 * The returned object always includes a `confidence` value (0–1) that
 * reflects how many eligible lines were successfully parsed, giving callers
 * a reliable signal of parse quality.
 */
export async function parseReceiptText(
  text: string,
  format?: IReceiptFormat
): Promise<FormatAwareParseResult> {
  // Determine which format to use
  let activeFormat = format ?? null;
  let detectedInfo: FormatAwareParseResult['detectedFormat'] = null;

  if (!activeFormat) {
    const detection = await detectFormat(text);
    if (detection) {
      activeFormat = detection.format;
      detectedInfo = {
        id: detection.format.id,
        name: detection.format.name,
        score: detection.score,
      };
    }
  } else {
    detectedInfo = {
      id: activeFormat.id,
      name: activeFormat.name,
      score: -1, // sentinel: explicitly supplied, not auto-detected
    };
  }

  // If we have a format, use the format-driven parser
  if (activeFormat) {
    const parsed = parseReceiptWithFormat(text, activeFormat);
    return { ...parsed, detectedFormat: detectedInfo };
  }

  // ---------------------------------------------------------------------------
  // Fallback parser — no format available.
  // Uses broad heuristics so that a basic receipt can still be extracted.
  // ---------------------------------------------------------------------------
  return parseFallback(text);
}

// ---------------------------------------------------------------------------
// Fallback (no-format) parser
// ---------------------------------------------------------------------------

/** Common words that signal a total/subtotal line. */
const FALLBACK_TOTAL_WORDS = ['total', 'balance', 'amount due'];

/** Common words that signal a tax or subtotal line to skip. */
const FALLBACK_SKIP_WORDS = ['subtotal', 'tax', 'gst', 'pst', 'hst'];

/**
 * Minimal heuristic parser used when no receipt format has been defined.
 * Every eligible line is tested against a `$?price` regex at end-of-line.
 * Confidence equals the fraction of candidate lines that yielded an item.
 */
function parseFallback(text: string): FormatAwareParseResult {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const items: ParsedReceipt['items'] = [];
  const skippedLines: string[] = [];
  let total: number | undefined;
  let candidateCount = 0;
  let parsedCount = 0;

  // Date regex used only for store/date extraction (informational)
  const datePattern =
    /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/;

  // Price at end of line: optional $, digits, dot, two digits
  const priceAtEnd = /\$?\s*(\d+\.\d{2})\s*$/;

  for (const line of lines) {
    // Date extraction (informational, not counted toward confidence)
    datePattern.test(line);

    const lower = line.toLowerCase();

    // Total / balance lines → record value and skip
    if (FALLBACK_TOTAL_WORDS.some((w) => lower.includes(w))) {
      const m = line.match(priceAtEnd);
      if (m) total = parseFloat(m[1]);
      continue;
    }

    // Tax / subtotal → skip entirely
    if (FALLBACK_SKIP_WORDS.some((w) => lower.includes(w))) continue;

    // Every other line is a candidate
    candidateCount++;

    const match = line.match(priceAtEnd);
    if (!match) {
      skippedLines.push(line);
      continue;
    }

    const price = parseFloat(match[1]);
    const description = line.substring(0, match.index).trim();

    if (!description) {
      skippedLines.push(line);
      continue;
    }

    // Quantity pattern: "3 x " or "3@ " at the start of description
    const qtyPattern = /^(\d+)\s*[@xX]\s*/;
    const qtyMatch = description.match(qtyPattern);

    const cleanDesc = qtyMatch
      ? description.substring(qtyMatch[0].length).trim()
      : description;

    const item: ParsedReceipt['items'][number] = {
      description: cleanDesc,
      price,
      originalLine: line,
    };

    if (qtyMatch) item.quantity = parseInt(qtyMatch[1], 10);

    items.push(item);
    parsedCount++;
  }

  const confidence = candidateCount > 0 ? parsedCount / candidateCount : 0;

  return {
    items,
    total,
    skippedLines,
    confidence,
    detectedFormat: null,
  };
}

// ---------------------------------------------------------------------------
// CSV export helper
// ---------------------------------------------------------------------------

/**
 * Convert a `FormatAwareParseResult` into a simple CSV string.
 * Each row contains: description, price, and (if present) quantity.
 */
export function receiptToCSV(parsed: FormatAwareParseResult): string {
  const header = ['Description', 'Price', 'Quantity'];
  const rows: string[][] = [header];

  for (const item of parsed.items) {
    rows.push([
      item.description,
      item.price.toFixed(2),
      item.quantity?.toString() ?? '',
    ]);
  }

  return rows
    .map((row) =>
      row
        .map((cell) => (cell.includes(',') ? `"${cell}"` : cell))
        .join(',')
    )
    .join('\n');
}
