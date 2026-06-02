import { describe, it, expect } from 'vitest';
import { validatePassword, getPasswordStrength, getStrengthColor, getStrengthText } from '../passwordValidation';

describe('validatePassword', () => {
  it('rejects passwords shorter than 12 characters', () => {
    const result = validatePassword('Abc1!');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('12 caracteres');
    expect(result.strength).toBe('weak');
  });

  it('rejects 12-char password without enough character variety (less than 3 types)', () => {
    const result = validatePassword('abcdefghijkl');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('3 de');
    expect(result.strength).toBe('weak');
  });

  it('accepts valid password with uppercase, number, and special char (12 chars)', () => {
    const result = validatePassword('Abcdefgh1!kl');
    expect(result.valid).toBe(true);
    expect(result.strength).toBeDefined();
  });

  it('accepts valid password with uppercase, lowercase, and number (no symbol)', () => {
    const result = validatePassword('Abcdefgh1234');
    expect(result.valid).toBe(true);
    expect(result.strength).toBeDefined();
  });

  it('accepts valid password with uppercase, lowercase, and symbol (no number)', () => {
    const result = validatePassword('Abcdefgh!@#$');
    expect(result.valid).toBe(true);
  });

  it('accepts valid password with lowercase, number, and symbol (no uppercase)', () => {
    const result = validatePassword('abcdefgh1!kl');
    expect(result.valid).toBe(true);
  });

  it('handles empty password', () => {
    const result = validatePassword('');
    expect(result.valid).toBe(false);
  });

  it('handles password with spaces', () => {
    const result = validatePassword('Abc 123!@# def');
    expect(result.valid).toBe(true);
  });
});

describe('getPasswordStrength', () => {
  it('returns medium for 12-char passwords with 4 criteria', () => {
    expect(getPasswordStrength('Abcdefgh1234')).toBe('medium');
  });

  it('returns weak for minimal criteria', () => {
    expect(getPasswordStrength('Abcdefgh123')).toBe('weak');
  });

  it('returns strong for long complex passwords (validatePassword)', () => {
    const result = validatePassword('Abcdefgh1234$');
    expect(result.strength).toBe('strong');
  });

  it('returns strong for long complex passwords', () => {
    expect(getPasswordStrength('Abcdefgh1234!@#$XYZ')).toBe('strong');
  });
});

describe('getStrengthColor', () => {
  it('returns red-500 for weak', () => {
    expect(getStrengthColor('weak')).toBe('bg-red-500');
  });

  it('returns yellow-500 for medium', () => {
    expect(getStrengthColor('medium')).toBe('bg-yellow-500');
  });

  it('returns green-500 for strong', () => {
    expect(getStrengthColor('strong')).toBe('bg-green-500');
  });
});

describe('getStrengthText', () => {
  it('returns Débil for weak', () => {
    expect(getStrengthText('weak')).toBe('Débil');
  });

  it('returns Media for medium', () => {
    expect(getStrengthText('medium')).toBe('Media');
  });

  it('returns Fuerte for strong', () => {
    expect(getStrengthText('strong')).toBe('Fuerte');
  });
});
