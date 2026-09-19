import type { ModelInfo } from '~/lib/modules/llm/types';

export interface ParsedModelPricing {
  prompt: string;
  completion: string;
  isFree: boolean;
  formatted: string;
}

export interface ParsedModelInfo {
  cleanName: string;
  pricing: ParsedModelPricing | null;
}

/**
 * Parses a model's label string to extract clean name and structured pricing.
 * Formats like: "Google: Gemini 3.5 Flash Lite (batch) - in:$0.08 out:$0.30 - context 1M"
 */
export const parseModelLabel = (label: string): ParsedModelInfo => {
  if (!label) {
    return { cleanName: '', pricing: null };
  }

  const pricingMatch = label.match(/\s*-\s*in:\$([\d\.]+)\s+out:\$([\d\.]+)/i);

  if (!pricingMatch) {
    // Check for explicit (free) in label or zero cost
    const isFree = /\bfree\b/i.test(label);
    const cleanName = label.replace(/\s*-\s*context\s+[^\s]+/i, '').trim();

    return {
      cleanName,
      pricing: isFree ? { prompt: '0.00', completion: '0.00', isFree: true, formatted: 'Free' } : null,
    };
  }

  const prompt = pricingMatch[1];
  const completion = pricingMatch[2];
  const isFree = parseFloat(prompt) === 0 && parseFloat(completion) === 0;

  // Format pricing cleanly
  const formatted = isFree ? 'Free' : `in: $${prompt} · out: $${completion} / 1M`;

  // Remove the pricing and trailing context
  let cleanName = label.replace(/\s*-\s*in:\$[\d\.]+\s+out:\$[\d\.]+/i, '');
  cleanName = cleanName.replace(/\s*-\s*context\s+[^\s]+/i, '').trim();

  return {
    cleanName,
    pricing: {
      prompt,
      completion,
      isFree,
      formatted,
    },
  };
};

// Levenshtein distance for fuzzy search
export const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }

  return matrix[str2.length][str1.length];
};

/**
 * Advanced multi-token fuzzy matching algorithm:
 * - Splits search query into tokens (e.g. "gemini flash" -> ["gemini", "flash"]).
 * - Checks if each token matches within the text (cleanName, model id, etc.).
 * - Rewards prefix matches, whole word matches, and tokens in order.
 * - Supports typo tolerance via Levenshtein distance for tokens with 3+ characters.
 */
export const fuzzyMatch = (query: string, text: string): { score: number; matches: boolean } => {
  if (!query || !query.trim()) {
    return { score: 100, matches: true };
  }

  if (!text) {
    return { score: 0, matches: false };
  }

  const queryLower = query.toLowerCase().trim();
  const textLower = text.toLowerCase().trim();

  // 1. Exact match
  if (textLower === queryLower) {
    return { score: 100, matches: true };
  }

  // 2. Exact contiguous substring match
  const subIdx = textLower.indexOf(queryLower);
  if (subIdx >= 0) {
    const isPrefix = subIdx === 0;
    return { score: isPrefix ? 99 : Math.max(70, 95 - subIdx), matches: true };
  }

  // 3. Multi-token match
  const tokens = queryLower.split(/[\s\-_\/:]+/).filter(Boolean);
  if (tokens.length === 0) {
    return { score: 100, matches: true };
  }

  const words = textLower.split(/[\s\-_\/:]+/).filter(Boolean);
  let totalScore = 0;
  let allMatched = true;

  for (const token of tokens) {
    // Check exact substring in text
    if (textLower.includes(token)) {
      const isWordStart = words.some((w) => w.startsWith(token));
      totalScore += isWordStart ? 25 : 15;
      continue;
    }

    // Check typo tolerance: requires min 4 chars, identical starting letter, and diff <= 1 (or <= 2 for >= 8 chars)
    let tokenFuzzyMatched = false;
    if (token.length >= 4) {
      for (const w of words) {
        if (w.length >= 4 && token[0] === w[0]) {
          const lenDiff = Math.abs(w.length - token.length);
          if (token.length < 8 && lenDiff <= 1) {
            if (levenshteinDistance(token, w) <= 1) {
              totalScore += 10;
              tokenFuzzyMatched = true;
              break;
            }
          } else if (token.length >= 8 && lenDiff <= 2) {
            if (levenshteinDistance(token, w) <= 2) {
              totalScore += 10;
              tokenFuzzyMatched = true;
              break;
            }
          }
        }
      }
    }

    if (!tokenFuzzyMatched) {
      allMatched = false;
      break;
    }
  }

  if (allMatched) {
    // Bonus if tokens appear in sequential order
    let lastIdx = 0;
    let inOrder = true;
    for (const token of tokens) {
      const idx = textLower.indexOf(token, lastIdx);
      if (idx === -1) {
        inOrder = false;
        break;
      }
      lastIdx = idx + token.length;
    }
    if (inOrder) {
      totalScore += 15;
    }

    const finalScore = Math.min(95, Math.max(50, 35 + totalScore));
    return { score: finalScore, matches: true };
  }

  return { score: 0, matches: false };
};

/**
 * Highlights all matched tokens in the text.
 */
export const highlightText = (text: string, query: string): string => {
  if (!query || !query.trim() || !text) {
    return text;
  }

  const tokens = query.trim().split(/[\s\-_\/:]+/).filter((t) => t.length > 0);
  if (tokens.length === 0) {
    return text;
  }

  // Deduplicate and sort by length descending so longer tokens match first
  const uniqueTokens = Array.from(new Set(tokens.map((t) => t.toLowerCase())));
  uniqueTokens.sort((a, b) => b.length - a.length);

  const pattern = uniqueTokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');

  return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 text-current">$1</mark>');
};

export const formatContextSize = (tokens: number): string => {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }

  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(0)}K`;
  }

  return tokens.toString();
};

// Helper function to determine if a model is likely free
export const isModelLikelyFree = (model: ModelInfo, providerName?: string): boolean => {
  if (providerName === 'OpenRouter' && model.label.includes('in:$0.00') && model.label.includes('out:$0.00')) {
    return true;
  }

  if (model.name.toLowerCase().includes('free') || model.label.toLowerCase().includes('free')) {
    return true;
  }

  const parsed = parseModelLabel(model.label);
  return parsed.pricing?.isFree ?? false;
};
