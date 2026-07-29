import { describe, expect, it } from 'vitest';
import {
  matchFavoriteLocations,
  prepareLocationAliases,
  type FavoriteLocation,
} from '@/hooks/useFavoriteLocations';

const location: FavoriteLocation = {
  id: 'location-1',
  name: 'Custodia G5N',
  aliases: ['Base G5N', 'Instalaciones G5N'],
  address: null,
  category: 'recurrente',
  latitude: -27.3464396,
  longitude: -70.6313583,
  routing_access_latitude: -27.34747,
  routing_access_longitude: -70.63322,
  usage_count: 4,
};

describe('favorite location aliases', () => {
  it('finds a recurrent location by any configured alias', () => {
    expect(matchFavoriteLocations('instalaciones', [location])).toEqual([location]);
  });

  it('preserves the previous visible name as an alias after renaming', () => {
    expect(
      prepareLocationAliases({
        name: 'Base y Custodia G5N',
        previousName: 'Custodia G5N',
        aliases: ['Instalaciones G5N'],
      }),
    ).toEqual(['Instalaciones G5N', 'Custodia G5N']);
  });

  it('removes duplicate aliases and aliases equal to the visible name', () => {
    expect(
      prepareLocationAliases({
        name: 'Custodia G5N',
        aliases: ['custodia g5n', 'Base G5N', 'BASE G5N'],
      }),
    ).toEqual(['Base G5N']);
  });
});
