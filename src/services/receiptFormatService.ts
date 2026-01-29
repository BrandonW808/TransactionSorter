import ReceiptFormat, { IReceiptFormat, ILineRule } from '../models/ReceiptFormat.model';
import {
  CreateReceiptFormatRequest,
  UpdateReceiptFormatRequest,
  ParsedReceiptLine,
} from '../types';

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

/**
 * Create a new receipt format definition in the database.
 */
export async function createReceiptFormat(
  data: CreateReceiptFormatRequest
): Promise<IReceiptFormat> {
  const format = new ReceiptFormat(data);
  return format.save();
}

/**
 * Retrieve every stored receipt format.
 */
export async function getAllReceiptFormats(): Promise<IReceiptFormat[]> {
  return ReceiptFormat.find({}).sort({ name: 1 });
}

/**
 * Look up a single receipt format by its database ID.
 */
export async function getReceiptFormatById(
  id: string
): Promise<IReceiptFormat | null> {
  return ReceiptFormat.findById(id);
}

/**
 * Update an existing receipt format.  Only the fields present in `data` are
 * overwritten; the rest remain unchanged.
 */
export async function updateReceiptFormat(
  id: string,
  data: UpdateReceiptFormatRequest
): Promise<IReceiptFormat | null> {
  return ReceiptFormat.findByIdAndUpdate(id, { $set: data }, {
    new: true,
    runValidators: true,
  });
}

/**
 * Permanently delete a receipt format by ID.
 */
export async function deleteReceiptFormat(id: string): Promise<boolean> {
  const result = await ReceiptFormat.findByIdAndDelete(id);
  return result !== null;
}

// ---------------------------------------------------------------------------
// Format detection (auto-select the best format for a raw OCR text)
// ---------------------------------------------------------------------------

interface FormatScore {
  format: IReceiptFormat;
  score: number;
}

/**
 * Score a single format against the given raw receipt text.
 *
 * Scoring strategy (additive):
 *   +10 per store keyword found (case-insensitive substring match).
 *   + 5 per section header line that actually appears in the text.
 *   + 5 per total keyword whose prefix is found on any line.
 *   + 3 per line that is successfully parsed by at least one of the format's
 *         line rules (rewards formats whose rules are comprehensive).
 *
 * A format with *zero* store keywords still receives line-rule scores, so
 * even generic formats compete fairly against store-specific ones.
 */
function scoreFormat(format: IReceiptFormat, lines: string[]): number {
  const lowerText = lines.map((l) => l.toLowerCase()).join('\n');
  let score = 0;

  // Store keywords
  for (const kw of format.storeKeywords) {
    if (lowerText.includes(kw.toLowerCase())) {
      score += 10;
    }
  }

  // Section headers present in text
  for (const hdr of format.sectionHeaders) {
    if (lines.some((l) => l.trim().toUpperCase() === hdr.toUpperCase())) {
      score += 5;
    }
  }

  // Total keywords present
  for (const tk of format.totalKeywords) {
    if (lines.some((l) => l.trim().toLowerCase().startsWith(tk.toLowerCase()))) {
      score += 5;
    }
  }

  // Lines that match at least one line rule
  for (const line of lines) {
    if (testLineRules(line, format.lineRules)) {
      score += 3;
    }
  }

  return score;
}

/**
 * Return true if at least one rule in `rules` matches `line`.
 */
function testLineRules(line: string, rules: ILineRule[]): boolean {
  for (const rule of rules) {
    try {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(line.trim())) return true;
    } catch {
      // Malformed regex — skip gracefully
    }
  }
  return false;
}

/**
 * Evaluate every stored format against `rawText` and return the one with the
 * highest score.  Returns `null` when no formats exist in the database.
 */
export async function detectFormat(
  rawText: string
): Promise<{ format: IReceiptFormat; score: number } | null> {
  const formats = await getAllReceiptFormats();
  if (formats.length === 0) return null;

  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

  const scored: FormatScore[] = formats.map((fmt) => ({
    format: fmt,
    score: scoreFormat(fmt, lines),
  }));

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Only return a result when the top scorer actually matched something
  if (scored[0].score > 0) {
    return { format: scored[0].format, score: scored[0].score };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Line-level parsing using a format's rules
// ---------------------------------------------------------------------------

/**
 * Attempt to parse a single trimmed line using the ordered `lineRules`.
 * Returns the first successful match or `null` if no rule matches.
 *
 * Each rule's named capture groups are mapped to fields via `rule.captures`.
 * Only `description` and `price` are required for a match to succeed;
 * `quantity` and `unit` are optional enrichments.
 */
export function parseLineWithRules(
  line: string,
  rules: ILineRule[]
): ParsedReceiptLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  for (const rule of rules) {
    let regex: RegExp;
    try {
      regex = new RegExp(rule.pattern, 'i');
    } catch {
      // Malformed pattern stored in DB — skip
      continue;
    }

    const match = trimmed.match(regex);
    if (!match?.groups) continue;

    const groups = match.groups;
    const descField = findCaptureByTarget(rule.captures, 'description');
    const priceField = findCaptureByTarget(rule.captures, 'price');

    if (!descField || !priceField) continue;

    const rawDesc = groups[descField];
    const rawPrice = groups[priceField];

    if (!rawDesc || !rawPrice) continue;

    const price = parseFloat(rawPrice);
    if (isNaN(price)) continue;

    const result: ParsedReceiptLine = {
      description: rawDesc.trim(),
      price,
      originalLine: trimmed,
    };

    // Optional quantity
    const qtyField = findCaptureByTarget(rule.captures, 'quantity');
    if (qtyField && groups[qtyField]) {
      const qty = parseFloat(groups[qtyField]);
      if (!isNaN(qty)) result.quantity = qty;
    }

    // Optional unit
    const unitField = findCaptureByTarget(rule.captures, 'unit');
    if (unitField && groups[unitField]) {
      result.unit = groups[unitField].trim();
    }

    return result;
  }

  return null;
}

/**
 * Return the capture-group name whose target equals `target`, or undefined.
 */
function findCaptureByTarget(
  captures: Record<string, string>,
  target: string
): string | undefined {
  return Object.entries(captures).find(([, val]) => val === target)?.[0];
}

// ---------------------------------------------------------------------------
// Full receipt parsing (format-driven)
// ---------------------------------------------------------------------------

export interface ParsedReceipt {
  /** Successfully parsed line items. */
  items: ParsedReceiptLine[];
  /** The last total/subtotal value found, if any. */
  total: number | undefined;
  /** Lines that were skipped (section headers, totals, unrecognised). */
  skippedLines: string[];
  /**
   * Parser-level confidence as a value between 0 and 1.
   * Calculated as `parsedLineCount / totalNonEmptyLines` (after removing
   * section headers and total lines).  Rewards formats whose rules
   * successfully extract the most lines.
   */
  confidence: number;
}

/**
 * Parse raw receipt text using a specific `IReceiptFormat`.
 *
 * Algorithm (per line, in order):
 *   1. Empty lines → skip.
 *   2. Matches a section header (case-insensitive exact match) → skip.
 *   3. Starts with a total keyword → record as candidate total, skip.
 *   4. Starts with a discount indicator → attempt to apply as a negative
 *      adjustment to the most recently parsed item.
 *   5. Run through all `lineRules` — if one matches, emit a parsed item.
 *   6. Otherwise the line is unrecognised; record in `skippedLines`.
 *
 * Confidence is computed over the "candidate" lines (everything except
 * section headers and total lines), rewarding formats that parse more.
 */
export function parseReceiptWithFormat(
  rawText: string,
  format: IReceiptFormat
): ParsedReceipt {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: ParsedReceiptLine[] = [];
  const skippedLines: string[] = [];
  let total: number | undefined;
  let candidateLineCount = 0; // lines eligible for item parsing
  let parsedCount = 0; // lines that produced an item or discount

  // Pre-compute lower-cased sets for O(1) checks
  const headerSet = new Set(
    format.sectionHeaders.map((h) => h.toUpperCase())
  );
  const totalPrefixes = format.totalKeywords.map((t) => t.toLowerCase());
  const discountPrefixes = format.discountIndicators.map((d) => d.toLowerCase());

  for (const line of lines) {
    const upper = line.toUpperCase();
    const lower = line.toLowerCase();

    // 1. Section header → skip entirely, not counted for confidence
    if (headerSet.has(upper)) continue;

    // 2. Total / subtotal keyword → record value if present, skip
    if (totalPrefixes.some((prefix) => lower.startsWith(prefix))) {
      const numMatch = line.match(/(-?\d+(?:\.\d+)?)\s*$/);
      if (numMatch) total = parseFloat(numMatch[1]);
      continue;
    }

    // From here every line is a "candidate" for confidence calculation
    candidateLineCount++;

    // 3. Discount indicator → adjust previous item
    if (discountPrefixes.some((prefix) => lower.startsWith(prefix))) {
      const numMatch = line.match(/(-?\d+(?:\.\d+)?)\s*$/);
      if (numMatch && items.length > 0) {
        const discountValue = parseFloat(numMatch[1]);
        // Negative price on the line means a subtraction; positive means
        // the format lists discount amounts as positive numbers.
        items[items.length - 1].price += discountValue < 0
          ? discountValue
          : -discountValue;
        parsedCount++;
      } else {
        skippedLines.push(line);
      }
      continue;
    }

    // 4. Try line rules
    const parsed = parseLineWithRules(line, format.lineRules);
    if (parsed) {
      items.push(parsed);
      parsedCount++;
      continue;
    }

    // 5. Unrecognised
    skippedLines.push(line);
  }

  const confidence =
    candidateLineCount > 0 ? parsedCount / candidateLineCount : 0;

  return { items, total, skippedLines, confidence };
}
