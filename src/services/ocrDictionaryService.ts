// src/services/ocrDictionaryService.ts
import OCRCorrection, { IOCRCorrection } from '../models/OCRDictionary.model';

/**
 * Get all stored OCR corrections, optionally filtered by context.
 */
export async function getAllCorrections(context?: string): Promise<IOCRCorrection[]> {
    const query = context ? { context } : {};
    return OCRCorrection.find(query).sort({ frequency: -1 });
}

/**
 * Add or update an OCR correction mapping.
 * If the same ocrText+context exists, increment frequency instead.
 */
export async function addCorrection(
    ocrText: string,
    correctedText: string,
    context?: string
): Promise<IOCRCorrection> {
    const existing = await OCRCorrection.findOne({
        ocrText: ocrText.trim(),
        context: context || { $exists: false },
    });

    if (existing) {
        existing.correctedText = correctedText.trim();
        existing.frequency += 1;
        return existing.save();
    }

    return OCRCorrection.create({
        ocrText: ocrText.trim(),
        correctedText: correctedText.trim(),
        context,
    });
}

/**
 * Bulk add corrections from a diff between original and corrected text.
 */
export async function addCorrectionsFromDiff(
    originalLines: string[],
    correctedLines: string[],
    context?: string
): Promise<IOCRCorrection[]> {
    const corrections: IOCRCorrection[] = [];

    // Find word-level differences
    for (let i = 0; i < Math.min(originalLines.length, correctedLines.length); i++) {
        const origWords = originalLines[i].split(/\s+/);
        const corrWords = correctedLines[i].split(/\s+/);

        // Simple word-by-word comparison
        for (let j = 0; j < Math.min(origWords.length, corrWords.length); j++) {
            const orig = origWords[j].trim();
            const corr = corrWords[j].trim();

            // Skip if identical, empty, or just punctuation/numbers
            if (
                orig === corr ||
                !orig ||
                !corr ||
                /^[\d.,]+$/.test(orig) ||
                /^[\d.,]+$/.test(corr)
            ) {
                continue;
            }

            // Only save if it looks like a meaningful word correction
            if (orig.length >= 2 && corr.length >= 2) {
                const correction = await addCorrection(orig, corr, context);
                corrections.push(correction);
            }
        }
    }

    return corrections;
}

/**
 * Apply all known corrections to a block of text.
 * Returns the corrected text and a list of corrections that were applied.
 */
export async function applyCorrections(
    text: string,
    context?: string
): Promise<{ correctedText: string; appliedCorrections: { from: string; to: string }[] }> {
    // Get corrections sorted by frequency (most common first) and length (longer first)
    const corrections = await OCRCorrection.find(
        context ? { $or: [{ context }, { context: { $exists: false } }] } : {}
    ).sort({ frequency: -1 });

    // Sort by length descending to apply longer matches first
    corrections.sort((a, b) => b.ocrText.length - a.ocrText.length);

    let correctedText = text;
    const appliedCorrections: { from: string; to: string }[] = [];

    for (const correction of corrections) {
        // Use word boundary matching to avoid partial replacements
        const regex = new RegExp(`\\b${escapeRegex(correction.ocrText)}\\b`, 'gi');

        if (regex.test(correctedText)) {
            correctedText = correctedText.replace(regex, correction.correctedText);
            appliedCorrections.push({
                from: correction.ocrText,
                to: correction.correctedText,
            });
        }
    }

    return { correctedText, appliedCorrections };
}

/**
 * Delete a correction by ID.
 */
export async function deleteCorrection(id: string): Promise<boolean> {
    const result = await OCRCorrection.findByIdAndDelete(id);
    return !!result;
}

/**
 * Update a correction by ID.
 */
export async function updateCorrection(
    id: string,
    ocrText: string,
    correctedText: string,
    context?: string
): Promise<IOCRCorrection | null> {
    return OCRCorrection.findByIdAndUpdate(
        id,
        {
            ocrText: ocrText.trim(),
            correctedText: correctedText.trim(),
            context,
        },
        { new: true }
    );
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}