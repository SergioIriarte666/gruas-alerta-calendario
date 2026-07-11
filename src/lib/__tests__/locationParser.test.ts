import { describe, expect, it } from 'vitest';
import { parseLocationInput } from '@/lib/locationParser';

describe('parseLocationInput', () => {
  it('parses a plain decimal pair', () => {
    const result = parseLocationInput('-27.3663, -70.3323');
    expect(result).toEqual({ lat: -27.3663, lng: -70.3323, source: 'decimal' });
  });

  it('parses a Chilean comma-decimal pair separated by spaces', () => {
    const result = parseLocationInput('-27,3663 -70,3323');
    expect(result).toEqual({ lat: -27.3663, lng: -70.3323, source: 'decimal' });
  });

  it('auto-corrects an inverted decimal pair', () => {
    const result = parseLocationInput('-70.3323, -27.3663');
    expect(result).toEqual({ lat: -27.3663, lng: -70.3323, source: 'decimal' });
  });

  it('parses DMS coordinates with typographic quotes', () => {
    const result = parseLocationInput('27°21’58.7”S 70°19’56.3”W');
    expect(result).not.toBeNull();
    const coords = result as { lat: number; lng: number; source: string };
    expect(coords.source).toBe('dms');
    expect(coords.lat).toBeCloseTo(-27.3663, 3);
    expect(coords.lng).toBeCloseTo(-70.3323, 3);
  });

  it('parses DMS coordinates with plain ASCII quotes', () => {
    const result = parseLocationInput(`27°21'58.7"S 70°19'56.3"W`);
    expect(result).not.toBeNull();
    const coords = result as { lat: number; lng: number; source: string };
    expect(coords.lat).toBeCloseTo(-27.3663, 3);
    expect(coords.lng).toBeCloseTo(-70.3323, 3);
  });

  it('prefers !3d!4d (exact pin) over @ (viewport center) in a long Google Maps URL', () => {
    const url =
      'https://www.google.com/maps/place/Ruta+C-397/@-27.3672,-70.3232,15z/data=!4m6!3m5!1s0x0:0x0!8m2!3d-27.3663!4d-70.3323!16s%2Fg%2F11';
    const result = parseLocationInput(url);
    expect(result).toEqual({ lat: -27.3663, lng: -70.3323, source: 'gmaps_url' });
  });

  it('falls back to @ viewport center when a long URL has no !3d!4d', () => {
    const url = 'https://www.google.com/maps/@-27.3663,-70.3323,15z';
    const result = parseLocationInput(url);
    expect(result).toEqual({ lat: -27.3663, lng: -70.3323, source: 'gmaps_url_center' });
  });

  it('flags a short Google Maps URL for server-side resolution', () => {
    const result = parseLocationInput('https://maps.app.goo.gl/AbCdEf123');
    expect(result).toEqual({ needsServerResolve: true, url: 'https://maps.app.goo.gl/AbCdEf123' });
  });

  it('returns an unresolvable error for a long Google Maps URL with no coordinates', () => {
    const result = parseLocationInput('https://www.google.com/maps/place/Ruta+C-397');
    expect(result).toEqual({ error: 'unresolvable_url' });
  });

  it('returns null for plain address text', () => {
    expect(parseLocationInput('Ruta C-397')).toBeNull();
  });

  it('still extracts an embedded decimal pair from a non-Google URL (generic text scan)', () => {
    // El detector de pares decimales no tiene nocion de dominios: solo
    // los links reconocidos de Google Maps se resuelven via resolve_link.
    const result = parseLocationInput('https://waze.com/ul?ll=-27.3663,-70.3323');
    expect(result).toEqual({ lat: -27.3663, lng: -70.3323, source: 'decimal' });
  });

  it('returns null for a non-Google URL with no embedded coordinates', () => {
    expect(parseLocationInput('https://waze.com/some/place')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseLocationInput('   ')).toBeNull();
  });
});
