import { describe, expect, it } from 'vitest';
import { parseLocationInput, startsWithPlusCode } from '@/lib/locationParser';

describe('parseLocationInput', () => {
  it('parses a plain decimal pair', () => {
    const result = parseLocationInput('-27.3663, -70.3323');
    expect(result).toEqual({ kind: 'coords', lat: -27.3663, lng: -70.3323, source: 'decimal' });
  });

  it('parses a Chilean comma-decimal pair separated by spaces', () => {
    const result = parseLocationInput('-27,3663 -70,3323');
    expect(result).toEqual({ kind: 'coords', lat: -27.3663, lng: -70.3323, source: 'decimal' });
  });

  it('auto-corrects an inverted decimal pair', () => {
    const result = parseLocationInput('-70.3323, -27.3663');
    expect(result).toEqual({ kind: 'coords', lat: -27.3663, lng: -70.3323, source: 'decimal' });
  });

  it('parses DMS coordinates with typographic quotes', () => {
    const result = parseLocationInput('27°21’58.7”S 70°19’56.3”W');
    expect(result.kind).toBe('coords');
    const coords = result as { lat: number; lng: number; source: string };
    expect(coords.source).toBe('dms');
    expect(coords.lat).toBeCloseTo(-27.3663, 3);
    expect(coords.lng).toBeCloseTo(-70.3323, 3);
  });

  it('parses DMS coordinates with plain ASCII quotes', () => {
    const result = parseLocationInput(`27°21'58.7"S 70°19'56.3"W`);
    expect(result.kind).toBe('coords');
    const coords = result as { lat: number; lng: number; source: string };
    expect(coords.lat).toBeCloseTo(-27.3663, 3);
    expect(coords.lng).toBeCloseTo(-70.3323, 3);
  });

  it('prefers !3d!4d (exact pin) over @ (viewport center) in a long Google Maps URL', () => {
    const url =
      'https://www.google.com/maps/place/Ruta+C-397/@-27.3672,-70.3232,15z/data=!4m6!3m5!1s0x0:0x0!8m2!3d-27.3663!4d-70.3323!16s%2Fg%2F11';
    const result = parseLocationInput(url);
    expect(result).toEqual({ kind: 'long_url', url, lat: -27.3663, lng: -70.3323 });
  });

  it('falls back to @ viewport center when a long URL has no !3d!4d', () => {
    const url = 'https://www.google.com/maps/@-27.3663,-70.3323,15z';
    const result = parseLocationInput(url);
    expect(result).toEqual({ kind: 'long_url', url, lat: -27.3663, lng: -70.3323 });
  });

  it('flags a short Google Maps URL for server-side resolution', () => {
    const result = parseLocationInput('https://maps.app.goo.gl/AbCdEf123');
    expect(result).toEqual({ kind: 'short_link', url: 'https://maps.app.goo.gl/AbCdEf123' });
  });

  it('leaves a long Google Maps URL without coordinates for the server to resolve', () => {
    const result = parseLocationInput('https://www.google.com/maps/place/Ruta+C-397');
    expect(result).toEqual({
      kind: 'long_url',
      url: 'https://www.google.com/maps/place/Ruta+C-397',
    });
  });

  it('detects a global plus code and normalizes it to uppercase', () => {
    expect(parseLocationInput('575fcmmc+qq')).toEqual({
      kind: 'plus_code_global',
      code: '575FCMMC+QQ',
    });
    expect(parseLocationInput('575FCMMC+QQ')).toEqual({
      kind: 'plus_code_global',
      code: '575FCMMC+QQ',
    });
  });

  it('detects a local plus code and keeps the locality attached', () => {
    expect(parseLocationInput('m939+cf Copiapó')).toEqual({
      kind: 'plus_code_local',
      code: 'M939+CF Copiapó',
    });
  });

  it('rejects plus-code-shaped strings that use letters outside the OLC alphabet', () => {
    // 'A', 'B', 'D', 'E', 'I', 'L', 'O', 'S', 'T', 'U', 'Y', 'Z' y '0'/'1'
    // no pertenecen al alfabeto Open Location Code.
    expect(parseLocationInput('ABCDEFGH+IJ').kind).toBe('text');
    expect(parseLocationInput('575FCMM0+QQ').kind).toBe('text');
  });

  it('treats a bare short plus code without locality as text', () => {
    expect(parseLocationInput('M939+CF').kind).toBe('text');
  });

  it('returns text for plain address text', () => {
    expect(parseLocationInput('Ruta C-397')).toEqual({ kind: 'text', value: 'Ruta C-397' });
  });

  it('collapses whitespace on free text', () => {
    expect(parseLocationInput('  Mantoverde   portería ')).toEqual({
      kind: 'text',
      value: 'Mantoverde portería',
    });
  });

  it('still extracts an embedded decimal pair from a non-Google URL (generic text scan)', () => {
    // El detector de pares decimales no tiene nocion de dominios: solo
    // los links reconocidos de Google Maps se resuelven via resolve_link.
    const result = parseLocationInput('https://waze.com/ul?ll=-27.3663,-70.3323');
    expect(result).toEqual({ kind: 'coords', lat: -27.3663, lng: -70.3323, source: 'decimal' });
  });

  it('returns text for a non-Google URL with no embedded coordinates', () => {
    expect(parseLocationInput('https://waze.com/some/place')).toEqual({
      kind: 'text',
      value: 'https://waze.com/some/place',
    });
  });

  it('returns empty text for empty input', () => {
    expect(parseLocationInput('   ')).toEqual({ kind: 'text', value: '' });
  });
});

describe('startsWithPlusCode', () => {
  it('detects a bare plus code and a plus code with a locality suffix', () => {
    expect(startsWithPlusCode('575FCMMC+QQ')).toBe(true);
    expect(startsWithPlusCode('575FCMMC+QQ Diego de Almagro, Chile')).toBe(true);
    expect(startsWithPlusCode('M939+CF Copiapó')).toBe(true);
  });

  it('leaves real addresses alone', () => {
    expect(startsWithPlusCode('Minera Mantoverde, Chañaral')).toBe(false);
    expect(startsWithPlusCode(null)).toBe(false);
    expect(startsWithPlusCode('')).toBe(false);
  });
});
