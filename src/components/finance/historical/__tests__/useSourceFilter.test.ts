import { describe, it, expect } from 'vitest';
import { matchesSource } from '../useSourceFilter';

describe('matchesSource', () => {
  it('"all" siempre coincide, sin importar el origen', () => {
    expect(matchesSource('historico', 'all')).toBe(true);
    expect(matchesSource('sistema', 'all')).toBe(true);
    expect(matchesSource(undefined, 'all')).toBe(true);
    expect(matchesSource(null, 'all')).toBe(true);
  });

  it('"historico" solo coincide con registros marcados como histórico', () => {
    expect(matchesSource('historico', 'historico')).toBe(true);
    expect(matchesSource('sistema', 'historico')).toBe(false);
  });

  it('"sistema" coincide con registros marcados como sistema', () => {
    expect(matchesSource('sistema', 'sistema')).toBe(true);
    expect(matchesSource('historico', 'sistema')).toBe(false);
  });

  it('valores undefined/null/desconocidos se tratan como "sistema" (default en BD)', () => {
    expect(matchesSource(undefined, 'sistema')).toBe(true);
    expect(matchesSource(null, 'sistema')).toBe(true);
    expect(matchesSource('otro-valor-inesperado', 'sistema')).toBe(true);
    expect(matchesSource(undefined, 'historico')).toBe(false);
  });
});
