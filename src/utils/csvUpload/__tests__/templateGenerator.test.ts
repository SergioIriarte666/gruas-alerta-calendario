/**
 * Genera la plantilla con supabase simulado y la relee:
 *  - con SheetJS, exactamente como el importador (SheetNames[0] + sheet_to_json header:1);
 *  - con exceljs, para inspeccionar nombres definidos, validaciones y fórmulas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {
  clients: [
    { name: 'Minera Zaldívar', rut: '76.1-1', department: 'Operaciones' },
    { name: 'Minera Zaldívar', rut: '76.1-1', department: 'Mantención' },
    { name: 'Transportes Sur', rut: '77.2-2', department: 'General' },
  ],
  service_types: [{ name: 'Traslado ' }, { name: 'Rescate' }],
  cranes: [{ license_plate: 'ABCD12', brand: 'Volvo', model: 'FH' }],
  operators: [{ name: 'Juan Soto', rut: '11.1-1' }, { name: 'Ana Díaz', rut: '22.2-2' }],
  services: [{ folio: 'SRV-7019' }, { folio: 'SRV-7020' }, { folio: 'SRV-826894' }, { folio: 'SRV-0003' }],
  vehicle_brands: [{ id: 'b1', name: 'Toyota' }, { id: 'b2', name: 'BMW' }],
  vehicle_models: [{ brand_id: 'b1', name: 'Yaris' }, { brand_id: 'b1', name: 'Hilux' }, { brand_id: 'b2', name: 'X5' }],
  company_data: [{ next_service_folio_number: 7005 }],
};

const builder = (table: string) => {
  const rows = tables[table] ?? [];
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, {
    select: self, eq: self, like: self, order: self, limit: self,
    range: (from: number, to: number) => Promise.resolve({ data: rows.slice(from, to + 1), error: null }),
    maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }),
  });
  return chain;
};

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => builder(t) } }));
vi.mock('@/utils/businessClock', () => ({ businessClock: { today: () => '2026-09-28' } }));

import { TemplateGenerator } from '@/utils/csvUpload/templateGenerator';
import { SERVICE_TEMPLATE_HEADERS } from '@/utils/csvUpload/templateCatalogs';

let captured: { blob: Blob; name: string } | null = null;

beforeEach(() => {
  captured = null;
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
  window.URL.createObjectURL = URL.createObjectURL;
  window.URL.revokeObjectURL = URL.revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as Blob;
    captured = { blob, name: this.download };
  });
});
afterEach(() => vi.restoreAllMocks());

const generate = async () => {
  const result = await TemplateGenerator.downloadExcelTemplate();
  expect(result).toEqual({ format: 'xlsx' });
  expect(captured?.name).toBe('plantilla_servicios_2026-09-28.xlsx');
  return Buffer.from(await captured!.blob.arrayBuffer());
};

describe('TemplateGenerator.downloadExcelTemplate', () => {
  it('produce un xlsx cuya primera hoja "Servicios" tiene los 21 headers exactos (lo que lee el importador)', async () => {
    const buffer = await generate();
    const wb = XLSX.read(buffer, { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['Servicios', 'Catalogos', 'Instrucciones']);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: true }) as unknown[][];
    expect(rows[0]).toEqual([...SERVICE_TEMPLATE_HEADERS]);
  });

  it('escribe catálogos, nombres definidos, validaciones de lista y fórmulas con el folio correlativo', async () => {
    const ExcelJS = await import('exceljs');
    const buffer = await generate();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const cat = wb.getWorksheet('Catalogos')!;
    expect([2, 3, 4].map(r => cat.getCell(`A${r}`).value)).toEqual([
      'Minera Zaldívar — Mantención', 'Minera Zaldívar — Operaciones', 'Transportes Sur',
    ]);
    expect(cat.getCell('C2').value).toBe('76.1-1');
    expect(cat.getCell('D2').value).toBe('Mantención');
    expect([cat.getCell('F2').value, cat.getCell('F3').value]).toEqual(['Rescate', 'Traslado']);
    expect([cat.getCell('H2').value, cat.getCell('I2').value]).toEqual(['ABCD12', 'Volvo FH']);
    expect([cat.getCell('K2').value, cat.getCell('L2').value]).toEqual(['Ana Díaz', '22.2-2']);
    expect([cat.getCell('N2').value, cat.getCell('N3').value]).toEqual(['BMW', 'Toyota']);
    expect([2, 3, 4].map(r => [cat.getCell(`P${r}`).value, cat.getCell(`Q${r}`).value])).toEqual([
      ['BMW', 'X5'], ['Toyota', 'Hilux'], ['Toyota', 'Yaris'],
    ]);

    const names = Object.fromEntries(
      ['ClientesTabla', 'ClientesLista', 'TiposLista', 'GruasLista', 'OperadoresTabla', 'OperadoresLista', 'MarcasLista', 'ModelosMarcas']
        .map(n => [n, wb.definedNames.getRanges(n).ranges]),
    );
    expect(names.ClientesTabla).toEqual(['Catalogos!$A$2:$D$4']);
    expect(names.ClientesLista).toEqual(['Catalogos!$A$2:$A$4']);
    expect(names.TiposLista).toEqual(['Catalogos!$F$2:$F$3']);
    // exceljs serializa un rango de una sola celda sin el ':$H$2'; Excel lo acepta igual.
    expect(names.GruasLista).toEqual(['Catalogos!$H$2']);
    expect(names.OperadoresTabla).toEqual(['Catalogos!$K$2:$L$3']);
    expect(names.OperadoresLista).toEqual(['Catalogos!$K$2:$K$3']);
    expect(names.MarcasLista).toEqual(['Catalogos!$N$2:$N$3']);
    expect(names.ModelosMarcas).toEqual(['Catalogos!$P$2:$P$4']);

    const ws = wb.getWorksheet('Servicios')!;
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    const dv = ws.dataValidations.model as Record<string, { type: string; formulae: string[]; allowBlank?: boolean }>;
    const findDv = (col: string) => Object.entries(dv).find(([k]) => k.startsWith(`${col}2`))?.[1];
    expect(findDv('E')).toMatchObject({ type: 'list', formulae: ['ClientesLista'], allowBlank: true });
    expect(findDv('L')).toMatchObject({ type: 'list', formulae: ['TiposLista'] });
    expect(findDv('N')).toMatchObject({ type: 'list', formulae: ['GruasLista'] });
    expect(findDv('U')).toMatchObject({ type: 'list', formulae: ['OperadoresLista'] });
    expect(findDv('G')).toMatchObject({ type: 'list', formulae: ['MarcasLista'], errorStyle: 'stop' });
    expect(findDv('H')).toMatchObject({
      type: 'list',
      errorStyle: 'stop',
      formulae: ['OFFSET(Catalogos!$Q$2,MATCH($G2,ModelosMarcas,0)-1,0,COUNTIF(ModelosMarcas,$G2),1)'],
    });

    // max real 7020 (ignora SRV-826894) > secuencia 7004 → correlativo parte en SRV-7021
    const formula = (addr: string) => (ws.getCell(addr).value as { formula: string }).formula;
    expect(formula('A2')).toBe('IF($E2="","","SRV-"&(7020+COUNTA($E$2:$E2)))');
    expect(formula('A151')).toContain('COUNTA($E$2:$E151)');
    expect(formula('D2')).toBe('IF($E2="","",IFERROR(VLOOKUP($E2,ClientesTabla,3,0),""))');
    expect(formula('F2')).toBe('IF($E2="","",IFERROR(VLOOKUP($E2,ClientesTabla,4,0),""))');
    expect(formula('O2')).toBe('IF($U2="","",IFERROR(VLOOKUP($U2,OperadoresTabla,2,0),""))');
    expect(ws.getCell('A152').value).toBeNull();

    expect(ws.getColumn('B').numFmt).toBe('dd/mm/yyyy');
    expect(ws.getColumn('M').numFmt).toBe('#,##0');
    // exceljs escribe calcPr pero no lo relee: se comprueba en el XML crudo.
    const { default: JSZip } = await import('jszip');
    const workbookXml = await (await JSZip.loadAsync(buffer)).file('xl/workbook.xml')!.async('string');
    expect(workbookXml).toMatch(/<calcPr[^>]*fullCalcOnLoad="1"/);
    expect(String(wb.getWorksheet('Instrucciones')!.getCell('A3').value)).toContain('SRV-7021');
  });

  it('usa el último de la secuencia cuando supera al máximo de services (folios quemados)', async () => {
    tables.company_data = [{ next_service_folio_number: 7031 }];
    try {
      const ExcelJS = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await generate());
      expect((wb.getWorksheet('Servicios')!.getCell('A2').value as { formula: string }).formula).toContain('7030+COUNTA');
    } finally {
      tables.company_data = [{ next_service_folio_number: 7005 }];
    }
  });

  it('cae a CSV e informa el motivo si la carga de catálogos falla', async () => {
    const original = tables.clients;
    tables.clients = undefined as unknown as Row[];
    vi.mocked(URL.createObjectURL);
    const failing = builder('clients');
    (failing as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve({ data: null, error: new Error('RLS') });
    const spy = vi.spyOn(TemplateGenerator, 'downloadTemplate');
    try {
      // fuerza el error reemplazando la tabla por un builder que falla
      const mod = await import('@/integrations/supabase/client');
      const from = mod.supabase.from as (t: string) => unknown;
      (mod.supabase as { from: unknown }).from = (t: string) => (t === 'clients' ? failing : from(t));
      const result = await TemplateGenerator.downloadExcelTemplate();
      expect(result).toEqual({ format: 'csv', reason: 'RLS' });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(captured?.name).toBe('plantilla_servicios_2026-09-28.csv');
      (mod.supabase as { from: unknown }).from = from;
    } finally {
      tables.clients = original;
    }
  });
});
