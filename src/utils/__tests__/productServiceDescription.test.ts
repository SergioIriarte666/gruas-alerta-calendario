import { describe, it, expect } from 'vitest';
import { getProductServiceDescriptionError, normalizeProductServiceDescription } from '../validationUtils';

describe('productServiceDescription validation', () => {
  it('normalizes empty to empty string', () => {
    expect(normalizeProductServiceDescription('')).toBe('');
    expect(normalizeProductServiceDescription(null)).toBe('');
    expect(normalizeProductServiceDescription(undefined)).toBe('');
  });

  it('trims and keeps value when within bounds', () => {
    expect(normalizeProductServiceDescription('  Descripción válida  ')).toBe('Descripción válida');
  });

  it('keeps short values as-is', () => {
    expect(normalizeProductServiceDescription('abc')).toBe('abc');
  });

  it('truncates when longer than 500', () => {
    const long = 'a'.repeat(600);
    const normalized = normalizeProductServiceDescription(long);
    expect(normalized.length).toBe(500);
  });

  it('returns error only for over 500 chars', () => {
    expect(getProductServiceDescriptionError('')).toBeNull();
    expect(getProductServiceDescriptionError('abc')).toBeNull();
    expect(getProductServiceDescriptionError('a'.repeat(500))).toBeNull();
    expect(getProductServiceDescriptionError('a'.repeat(501))).toBeTruthy();
  });
});
