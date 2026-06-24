import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { computeLegacyPreviewStats, parseLegacyServicesXLSX } from '@/utils/legacyServicesParser';

const headers = [
  'Fecha/hora de recepción', 'Ajustador', 'Referencia', 'Folio (Manual)', 'EXPEDIENTE',
  'Aseguradora', 'Tipo de servicio', 'Marca del vehículo', 'Tipo de vehículo',
  'Placas del vehículo', 'No. serie del vehículo (VIN)', 'Origen', 'Destino', 'Grúa',
  'Operador', 'Subtotal', 'Observaciones internas', 'Total',
];

const createFile = (dataRows: unknown[][], sheetName = 'Reporte') => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    [],
    ['', 'Reporte de memorias descriptivas'],
    [],
    ['', ...headers],
    ...dataRows.map((row) => ['', ...row]),
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new File([bytes], 'legacy.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

describe('legacyServicesParser', () => {
  it('parses fixed Reporte rows, NBSP meridiem and CLP amounts', async () => {
    const valid = [
      '01/09/2020 09:15:30 a.\u00a0m.', 'Ajustador', 'REF-1', 'F-1', 'EXP-1',
      'Arrendadora Ajustes', 'Arrastre', 'Toyota', 'SUV', 'ABCD12', 'VIN1',
      'Origen', 'Destino', 'G-1', 'Sergio Iriarte', '30,000.00', 'Observación', '35,700.00',
    ];
    const invalid = [...valid]; invalid[0] = 'fecha imposible'; invalid[3] = 'F-2';
    const rows = await parseLegacyServicesXLSX(createFile([valid, invalid]));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ _rowIndex: 5, _invalidDate: false, subtotal_clp: 30000, total_clp: 35700 });
    expect(rows[0].received_at).toContain('2020-09-01T13:15:30');
    expect(rows[1]).toMatchObject({ _rowIndex: 6, _invalidDate: true, received_at: null });

    const stats = computeLegacyPreviewStats(rows);
    expect(stats).toMatchObject({ total_rows: 2, valid_rows: 1, invalid_rows: 1, invalid_row_numbers: [6], period_from: '2020-09-01', period_to: '2020-09-01', total_subtotal_clp: 30000, total_total_clp: 35700 });
  });

  it('rejects files without the required sheet', async () => {
    await expect(parseLegacyServicesXLSX(createFile([], 'Otra'))).rejects.toThrow("hoja obligatoria 'Reporte'");
  });

  it('rejects a changed header', async () => {
    const file = createFile([]);
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    workbook.Sheets.Reporte.C4.v = 'Encabezado incorrecto';
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    await expect(parseLegacyServicesXLSX(new File([bytes], 'bad.xlsx'))).rejects.toThrow('Formato inválido');
  });
});
