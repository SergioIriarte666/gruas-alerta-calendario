import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'CLP'): string {
  const localeMap: Record<string, string> = {
    'CLP': 'es-CL',
    'USD': 'en-US', 
    'EUR': 'de-DE'
  };
  
  const locale = localeMap[currency] || 'es-CL';
  
  // CLP has no decimals; for others round to 2 decimals to avoid floating-point noise
  const rounded = currency === 'CLP' ? Math.round(amount) : Math.round(amount * 100) / 100;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(rounded)
}

/**
 * Calculates the Levenshtein distance between two strings.
 * Used for fuzzy matching client names.
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculates similarity between two strings (0 to 1).
 * 1 means identical, 0 means completely different.
 */
export function stringSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  const longer = s1.length > s2.length ? s1 : s2;
  if (longer.length === 0) return 1.0;
  return (longer.length - levenshteinDistance(s1, s2)) / longer.length;
}

/**
 * Converts a string to Title Case, handling Spanish prepositions and common company suffixes.
 */
export function toTitleCase(str: string): string {
  if (!str) return '';
  
  // Words that should remain lowercase (unless they are the first word)
  const smallWords = ['de', 'del', 'la', 'las', 'los', 'y', 'en', 'el', 'al', 'a', 'e', 'o', 'u', 'con', 'por', 'sin', 'para'];
  
  // Specific handling for company types and acronyms
  const specialWords: Record<string, string> = {
    'spa': 'SpA',
    's.p.a': 'SpA',
    's.p.a.': 'SpA',
    'eirl': 'EIRL',
    'e.i.r.l': 'EIRL',
    'e.i.r.l.': 'EIRL',
    'sa': 'S.A.',
    's.a': 'S.A.',
    's.a.': 'S.A.',
    'ltda': 'Ltda.',
    'ltd': 'Ltd.',
    'limitada': 'Limitada',
    'cia': 'Cía.',
    'c.i.a': 'Cía.',
    'sii': 'SII',
    'afp': 'AFP',
    'isapre': 'Isapre',
    'ii': 'II',
    'iii': 'III',
    'iv': 'IV',
    'vi': 'VI',
    'vii': 'VII',
    'viii': 'VIII',
    'ix': 'IX',
  };

  return str.trim().split(/\s+/).map((word, index) => {
    const lowerWord = word.toLowerCase();
    // Remove potential punctuation for checking (simple check)
    const cleanWord = lowerWord.replace(/[.,]/g, '');
    
    // Check exact match in special words
    if (specialWords[lowerWord]) return specialWords[lowerWord];
    if (specialWords[cleanWord]) return specialWords[cleanWord];

    // Preserve words that are all uppercase (likely acronyms like MCM, IBM, etc.)
    if (word.length >= 2 && word === word.toUpperCase() && /[A-Z]/.test(word)) {
      return word;
    }

    // Check if it's a small word
    if (index > 0 && smallWords.includes(lowerWord)) {
      return lowerWord;
    }

    // Default title case
    return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
  }).join(' ');
}
