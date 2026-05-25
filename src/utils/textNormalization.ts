/**
 * Spanish-aware Title Case normalization.
 *
 * Used to clean up text imported from sources (e.g. SII XML DTE) that comes
 * fully UPPERCASED. Only transforms strings detected as "shouting" — strings
 * already in mixed/lower case are returned untouched.
 *
 * Rules:
 *  - Capitalize first letter of each word.
 *  - Keep small Spanish words (de, del, la, las, el, los, y, e, o, u, a,
 *    en, con, para, por, al) lowercase unless they are the first word.
 *  - Preserve known acronyms with their canonical casing (SpA, S.A., Ltda,
 *    EIRL, RUT, SCM, etc).
 *  - Preserve alphanumeric tokens with digits or symbols (593/572, R2-8,
 *    FJX-FJX, 8MJ-8MP) as-is.
 */

const SMALL_WORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u',
  'a', 'en', 'con', 'para', 'por', 'al',
]);

const ACRONYMS: Record<string, string> = {
  spa: 'SpA',
  sa: 'SA',
  's.a.': 'S.A.',
  's.a': 'S.A.',
  ltda: 'Ltda',
  'ltda.': 'Ltda.',
  eirl: 'EIRL',
  rut: 'RUT',
  scm: 'SCM',
  sac: 'SAC',
  'cía': 'Cía',
  'cia': 'Cía',
};

const isShouting = (value: string): boolean => {
  const letters = value.match(/[a-záéíóúñ]/gi);
  if (!letters || letters.length < 3) return false;
  const upper = letters.filter((c) => c === c.toUpperCase()).length;
  return upper / letters.length >= 0.7;
};

const normalizeWord = (word: string, isFirst: boolean): string => {
  if (!word) return word;

  // Token has digits or symbols (other than period at end) → preserve as-is.
  if (/[0-9]/.test(word) || /[/\-_#°º:]/.test(word)) {
    return word;
  }

  const lower = word.toLowerCase();

  // Acronym lookup (with and without trailing period).
  if (ACRONYMS[lower]) return ACRONYMS[lower];
  const trimmed = lower.replace(/\.+$/, '');
  if (ACRONYMS[trimmed]) {
    const suffix = lower.slice(trimmed.length);
    return ACRONYMS[trimmed] + suffix;
  }

  // Small word → lowercase unless first.
  if (!isFirst && SMALL_WORDS.has(lower)) {
    return lower;
  }

  // Standard title case: capitalize first alphabetic char.
  return lower.replace(/^([^a-záéíóúñ]*)([a-záéíóúñ])/i, (_, prefix, ch) =>
    prefix + ch.toUpperCase()
  );
};

export const toTitleCaseEs = (value?: string | null): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  // Only normalize if input looks "shouting". Leave well-cased text alone.
  if (!isShouting(trimmed)) return trimmed;

  // Split preserving whitespace runs.
  const tokens = trimmed.split(/(\s+)/);
  let firstWordSeen = false;

  return tokens
    .map((token) => {
      if (/^\s+$/.test(token) || token === '') return token;
      const isFirst = !firstWordSeen;
      firstWordSeen = true;
      return normalizeWord(token, isFirst);
    })
    .join('');
};
