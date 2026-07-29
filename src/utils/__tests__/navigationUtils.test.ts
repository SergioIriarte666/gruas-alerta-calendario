import { describe, expect, it } from 'vitest';
import { buildNavigationUrl } from '@/utils/navigationUtils';

describe('buildNavigationUrl', () => {
  it('prioritizes confirmed coordinates over an ambiguous label', () => {
    const url = buildNavigationUrl('Custodia G5N', {
      lat: -27.3464396,
      lng: -70.6313583,
    });

    expect(url).not.toBeNull();
    const parsed = new URL(url as string);
    expect(parsed.pathname).toBe('/maps/dir/');
    expect(parsed.searchParams.get('destination')).toBe('-27.3464396,-70.6313583');
    expect(parsed.searchParams.get('travelmode')).toBe('driving');
  });

  it('keeps text navigation only as a fallback for legacy services', () => {
    const url = buildNavigationUrl('Ramón Freire 330, Copiapó');
    const parsed = new URL(url as string);

    expect(parsed.searchParams.get('destination')).toBe('Ramón Freire 330, Copiapó');
  });

  it('returns null when neither a label nor coordinates exist', () => {
    expect(buildNavigationUrl('  ')).toBeNull();
  });
});
