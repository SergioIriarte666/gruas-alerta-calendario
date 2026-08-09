import { describe, expect, it } from 'vitest';
import {
  catalogNameEquals,
  findCatalogMatch,
  normalizeCatalogName,
  normalizeVehicleFreeText,
} from '../vehicleCatalogMatch';

const BRANDS = [
  { id: '5abf7f27-b791-4614-a2d2-a2f78e331068', name: 'Nissan' },
  { id: 'b2', name: 'Great Wall' },
  { id: 'b3', name: 'Citroen' },
];

const MODELS = [
  { id: '108a88fa-13fd-4173-b423-8248a86169b3', name: 'Navara' },
  { id: 'm2', name: 'X-Trail' },
];

describe('normalizeCatalogName', () => {
  it('recorta, colapsa espacios internos y sube a mayúsculas', () => {
    expect(normalizeCatalogName('  great   wall ')).toBe('GREAT WALL');
  });

  it('ignora acentos', () => {
    expect(normalizeCatalogName('Citroën')).toBe('CITROEN');
  });
});

describe('findCatalogMatch', () => {
  // El caso que rompió SRV-6382: services.vehicle_brand traía 'Nissan ' y el
  // Select de Marca caía al placeholder por comparar el string crudo.
  it('resuelve la marca aunque el historial traiga un espacio final', () => {
    expect(findCatalogMatch(BRANDS, 'Nissan ')?.id).toBe(BRANDS[0].id);
  });

  it('resuelve ignorando casing y espacios internos dobles', () => {
    expect(findCatalogMatch(BRANDS, '  GREAT  WALL')?.id).toBe('b2');
  });

  it('resuelve el modelo contra el catálogo de la marca', () => {
    expect(findCatalogMatch(MODELS, ' navara ')?.id).toBe(MODELS[0].id);
  });

  it('devuelve undefined para marcas fuera de catálogo', () => {
    expect(findCatalogMatch(BRANDS, 'N/A')).toBeUndefined();
    expect(findCatalogMatch(BRANDS, 'Volare')).toBeUndefined();
    expect(findCatalogMatch(BRANDS, 'DS3')).toBeUndefined();
  });

  it('no calza con vacío ni con sólo espacios', () => {
    expect(findCatalogMatch(BRANDS, '')).toBeUndefined();
    expect(findCatalogMatch(BRANDS, '   ')).toBeUndefined();
    expect(findCatalogMatch(BRANDS, null)).toBeUndefined();
  });

  it('no confunde una marca con otra que la contiene', () => {
    expect(findCatalogMatch(BRANDS, 'Great')).toBeUndefined();
  });
});

describe('catalogNameEquals', () => {
  it('es falso cuando alguno de los dos es vacío', () => {
    expect(catalogNameEquals('', 'Nissan')).toBe(false);
    expect(catalogNameEquals('   ', 'Nissan')).toBe(false);
    expect(catalogNameEquals('Nissan', null)).toBe(false);
  });

  it('es verdadero ignorando espacios y casing', () => {
    expect(catalogNameEquals('nissan  ', ' Nissan')).toBe(true);
  });
});

describe('normalizeVehicleFreeText', () => {
  it('recorta y colapsa espacios sin tocar casing ni acentos', () => {
    expect(normalizeVehicleFreeText('  Nissan  Navara ')).toBe('Nissan Navara');
    expect(normalizeVehicleFreeText('Citroën ')).toBe('Citroën');
  });

  it('preserva null y undefined para no alterar el payload', () => {
    expect(normalizeVehicleFreeText(null)).toBeNull();
    expect(normalizeVehicleFreeText(undefined)).toBeUndefined();
  });

  it('deja la cadena vacía como vacía', () => {
    expect(normalizeVehicleFreeText('   ')).toBe('');
  });
});
