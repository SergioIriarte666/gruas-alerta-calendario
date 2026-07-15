import type { EntityKey } from '@/lib/entities';
import type { InventoryLocation } from '@/hooks/useInventory';

export type InventoryEntityFilter = 'all' | EntityKey;

export const INVENTORY_ENTITY_FILTER_STORAGE_KEY = 'inventory-entity-filter';

export const INVENTORY_ENTITY_FILTER_LABELS: Record<InventoryEntityFilter, string> = {
  all: 'Todas',
  gruas_5_norte: 'G5N',
  lowboy: 'LowBoy',
};

export const INVENTORY_LOCATION_ENTITY_LABELS: Record<EntityKey, string> = {
  gruas_5_norte: 'G5N',
  lowboy: 'LowBoy',
};

export const isInventoryEntityFilter = (value: string | null): value is InventoryEntityFilter =>
  value === 'all' || value === 'gruas_5_norte' || value === 'lowboy';

export const getLocationEntity = (location?: Pick<InventoryLocation, 'entity'> | null): EntityKey =>
  location?.entity === 'lowboy' ? 'lowboy' : 'gruas_5_norte';

export const filterLocationsByEntity = <T extends Pick<InventoryLocation, 'entity'>>(
  locations: T[],
  entityFilter: InventoryEntityFilter = 'all',
) => (entityFilter === 'all' ? locations : locations.filter((location) => getLocationEntity(location) === entityFilter));

export const sortLocationsForEntity = <T extends Pick<InventoryLocation, 'entity' | 'name'>>(
  locations: T[],
  entityFilter: InventoryEntityFilter = 'all',
) => {
  return [...locations].sort((a, b) => {
    if (entityFilter !== 'all') {
      const aMatches = getLocationEntity(a) === entityFilter;
      const bMatches = getLocationEntity(b) === entityFilter;
      if (aMatches !== bMatches) return aMatches ? -1 : 1;
    }
    return a.name.localeCompare(b.name, 'es');
  });
};

export const getEntityLocationIds = (
  locations: Array<Pick<InventoryLocation, 'id' | 'entity'>>,
  entityFilter: InventoryEntityFilter = 'all',
) => filterLocationsByEntity(locations, entityFilter).map((location) => location.id);
