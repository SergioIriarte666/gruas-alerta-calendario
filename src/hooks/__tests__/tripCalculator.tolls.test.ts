import { describe, expect, it } from 'vitest';

import { resolveRoundTripTollCost } from '@/hooks/useTripCalculation';

describe('resolveRoundTripTollCost', () => {
  it('keeps automatic toll totals unchanged when they already include round trip', () => {
    expect(resolveRoundTripTollCost(130700, true)).toBe(130700);
  });

  it('duplicates manual one-way toll amounts for round-trip estimates', () => {
    expect(resolveRoundTripTollCost(65350, false)).toBe(130700);
  });
});
