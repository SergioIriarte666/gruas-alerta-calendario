import { describe, expect, it } from 'vitest';
import {
  SERVICE_TEMPLATE_HEADERS,
  buildClientCatalog,
  buildOperatorCatalog,
  computeMaxFolioNumber,
} from '@/utils/csvUpload/templateCatalogs';

describe('SERVICE_TEMPLATE_HEADERS', () => {
  it('tiene 21 columnas (A..U) con Operador Nombre al final', () => {
    expect(SERVICE_TEMPLATE_HEADERS).toHaveLength(21);
    expect(SERVICE_TEMPLATE_HEADERS[0]).toBe('Folio');
    expect(SERVICE_TEMPLATE_HEADERS[4]).toBe('Cliente Nombre');   // E: lista
    expect(SERVICE_TEMPLATE_HEADERS[11]).toBe('Tipo Servicio');   // L: lista
    expect(SERVICE_TEMPLATE_HEADERS[13]).toBe('Grúa Patente');    // N: lista
    expect(SERVICE_TEMPLATE_HEADERS[14]).toBe('Operador RUT');    // O: fórmula
    expect(SERVICE_TEMPLATE_HEADERS[20]).toBe('Operador Nombre'); // U: lista
  });
});

describe('buildClientCatalog', () => {
  it('usa el nombre a secas cuando es único y agrega el departamento cuando se repite', () => {
    const rows = buildClientCatalog([
      { name: 'Minera Zaldívar', rut: '1-9', department: 'Mantención' },
      { name: 'Minera Zaldívar', rut: '1-9', department: 'Operaciones' },
      { name: 'Transportes Sur', rut: '2-7', department: 'General' },
    ]);
    expect(rows.map(r => r.label)).toEqual([
      'Minera Zaldívar — Mantención',
      'Minera Zaldívar — Operaciones',
      'Transportes Sur',
    ]);
    expect(rows[0]).toMatchObject({ name: 'Minera Zaldívar', rut: '1-9', department: 'Mantención' });
  });

  it('agrega el RUT si nombre y departamento también chocan', () => {
    const rows = buildClientCatalog([
      { name: 'Juan Pérez', rut: '11-1', department: 'General' },
      { name: 'Juan Pérez', rut: '22-2', department: 'General' },
    ]);
    expect(rows.map(r => r.label)).toEqual(['Juan Pérez — General (11-1)', 'Juan Pérez — General (22-2)']);
  });

  it('trata como iguales los nombres que solo difieren en mayúsculas/acentos y ordena alfabéticamente', () => {
    const rows = buildClientCatalog([
      { name: 'Ñandú SpA', rut: '3-3', department: 'A' },
      { name: 'ácido ltda', rut: '4-4', department: 'B' },
      { name: 'ACIDO LTDA', rut: '5-5', department: 'C' },
    ]);
    expect(rows.map(r => r.label)).toEqual(['ácido ltda — B', 'ACIDO LTDA — C', 'Ñandú SpA']);
  });

  it('descarta filas sin nombre y tolera nulos', () => {
    expect(buildClientCatalog([{ name: null, rut: null, department: null }, { name: '  ', rut: '1', department: 'X' }])).toEqual([]);
  });
});

describe('buildOperatorCatalog', () => {
  it('desambigua nombres repetidos con el RUT y recorta espacios', () => {
    const rows = buildOperatorCatalog([
      { name: ' Pedro Soto ', rut: '9-9' },
      { name: 'Pedro Soto', rut: '8-8' },
      { name: 'Ana Díaz', rut: '7-7' },
    ]);
    expect(rows.map(r => r.label)).toEqual(['Ana Díaz', 'Pedro Soto (8-8)', 'Pedro Soto (9-9)']);
    expect(rows[1]).toMatchObject({ name: 'Pedro Soto', rut: '8-8' });
  });
});

describe('computeMaxFolioNumber', () => {
  it('ignora el outlier SRV-826894 y los folios que no son SRV-NNNN', () => {
    expect(computeMaxFolioNumber(['SRV-7019', 'SRV-826894', 'SRV-7020', 'COT-99', 'SRV-ABC', null, undefined, 'srv-0005'])).toBe(7020);
  });

  it('devuelve 0 sin folios válidos', () => {
    expect(computeMaxFolioNumber([])).toBe(0);
    expect(computeMaxFolioNumber(['SRV-826894'])).toBe(0);
  });

  it('acepta un umbral distinto', () => {
    expect(computeMaxFolioNumber(['SRV-500', 'SRV-1500'], 1000)).toBe(500);
  });
});
