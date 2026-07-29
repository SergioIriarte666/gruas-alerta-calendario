import { describe, expect, it } from 'vitest';
import {
  formatChileAddress,
  formatChileLocationLabel,
} from '@/utils/chileLocationLabel';

describe('formatChileLocationLabel', () => {
  it('keeps a business name and a compact Chilean address', () => {
    expect(
      formatChileLocationLabel({
        mainText: 'Salfa',
        secondaryText: 'Panamericana Norte, 1530000 Copiapó, Atacama, Chile',
        formattedAddress: 'Panamericana Norte km 812, 1530000 Copiapó, Atacama, Chile',
      }),
    ).toBe('Salfa, Panamericana Norte, Copiapó');
  });

  it('removes postal code, region and country from a street address', () => {
    expect(
      formatChileAddress('Panamericana Norte km 812, 1530000 Copiapó, Atacama, Chile'),
    ).toBe('Panamericana Norte km 812, Copiapó');
  });

  it('does not duplicate the place name when Google repeats it', () => {
    expect(
      formatChileLocationLabel({
        mainText: 'Custodia G5N',
        secondaryText: 'Custodia G5N, Copiapó, Región de Atacama, Chile',
      }),
    ).toBe('Custodia G5N, Copiapó');
  });
});
