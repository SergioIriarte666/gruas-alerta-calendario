import { describe, it, expect } from 'vitest';
import { getProductServiceDescriptionError, normalizeProductServiceDescription } from '../validationUtils';

describe('productServiceDescription validation', () => {
  it('normalizes to fallback when too short', () => {
    expect(normalizeProductServiceDescription('')).toBe('Descripción no registrada');
    expect(normalizeProductServiceDescription('abc')).toBe('Descripción no registrada');
  });

  it('trims and keeps value when within bounds', () => {
    expect(normalizeProductServiceDescription('  Descripción válida  ')).toBe('Descripción válida');
  });

  it('truncates when longer than 500', () => {
    const long = 'a'.repeat(600);
    const normalized = normalizeProductServiceDescription(long);
    expect(normalized.length).toBe(500);
  });

  it('returns errors for out-of-range lengths', () => {
    expect(getProductServiceDescriptionError('abc')).toBeTruthy();
    expect(getProductServiceDescriptionError('a'.repeat(501))).toBeTruthy();
    expect(getProductServiceDescriptionError('a'.repeat(10))).toBeNull();
    expect(getProductServiceDescriptionError('a'.repeat(500))).toBeNull();
  });
});

