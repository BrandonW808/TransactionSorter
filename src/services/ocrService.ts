// src/services/ocrService.ts
import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import { IReceiptFormat } from '../models/ReceiptFormat.model';
import { detectFormat, parseReceiptWithFormat, ParsedReceipt } from './receiptFormatService';
import { applyCorrections } from './ocrDictionaryService';

interface OCRResult {
  text: string;
  confidence: number;
  /** Text after applying known corrections */
  correctedText?: string;
  /** List of corrections that were auto-applied */
  appliedCorrections?: { from: string; to: string }[];
}

/**
 * Preprocess an image buffer for better OCR accuracy.
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
 * Run Tesseract OCR on the given image buffer.
 * Optionally applies known corrections from the dictionary.
 */
export async function extractTextFromImage(
  imageBuffer: Buffer,
  language: string = 'eng+fra',
  autoCorrect: boolean = true,
  context?: string
): Promise<OCRResult> {
  try {
    const processedBuffer = await preprocessImage(imageBuffer);

    const { data } = await Tesseract.recognize(processedBuffer, language, {
      logger: (m: { progress?: number }) =>
        console.log('OCR Progress:', m.progress),
    });

    const result: OCRResult = {
      text: data.text,
      confidence: data.confidence,
    };

    // Apply auto-corrections if enabled
    if (autoCorrect) {
      const { correctedText, appliedCorrections } = await applyCorrections(
        data.text,
        context
      );
      result.correctedText = correctedText;
      result.appliedCorrections = appliedCorrections;
    }

    return result;
  } catch (error) {
    throw new Error(
      `OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ... rest of the file remains the same ...

export interface FormatAwareParseResult extends ParsedReceipt {
  detectedFormat: {
    id: string;
    name: string;
    score: number;
  } | null;
}

/**
 * Parse raw OCR text into structured receipt data.
 * Now accepts pre-corrected text from the user.
 */
export async function parseReceiptText(
  text: string,
  format?: IReceiptFormat
): Promise<FormatAwareParseResult> {
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
      score: -1,
    };
  }

  if (activeFormat) {
    const parsed = parseReceiptWithFormat(text, activeFormat);
    return { ...parsed, detectedFormat: detectedInfo };
  }

  return parseFallback(text);
}

const FALLBACK_TOTAL_WORDS = ['total', 'balance', 'amount due'];
const FALLBACK_SKIP_WORDS = ['subtotal', 'tax', 'gst', 'pst', 'hst'];

function parseFallback(text: string): FormatAwareParseResult {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const items: ParsedReceipt['items'] = [];
  const skippedLines: string[] = [];
  let total: number | undefined;
  let candidateCount = 0;
  let parsedCount = 0;

  const datePattern =
    /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/;
  const priceAtEnd = /\$?\s*(\d+\.\d{2})\s*$/;

  for (const line of lines) {
    datePattern.test(line);

    const lower = line.toLowerCase();

    if (FALLBACK_TOTAL_WORDS.some((w) => lower.includes(w))) {
      const m = line.match(priceAtEnd);
      if (m) total = parseFloat(m[1]);
      continue;
    }

    if (FALLBACK_SKIP_WORDS.some((w) => lower.includes(w))) continue;

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