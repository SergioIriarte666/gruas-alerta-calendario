import { describe, expect, it } from 'vitest';
import { compareLooseVersions } from '../liveUpdate';

describe('compareLooseVersions', () => {
  it('orders date-based bundle versions by correlativo', () => {
    expect(compareLooseVersions('2026.07.07-2', '2026.07.07-1')).toBeGreaterThan(0);
  });

  it('compares native semantic versions numerically', () => {
    expect(compareLooseVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
  });

  it('returns zero when versions are equal', () => {
    expect(compareLooseVersions('2.4.1', '2.4.1')).toBe(0);
  });
});
