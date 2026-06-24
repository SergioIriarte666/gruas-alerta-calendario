import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { computeLegacyPreviewStats, parseLegacyServicesXLSX } from '@/utils/legacyServicesParser';

const legacyHeaders = [
  'Fecha/hora de recepción', 'Ajustador', 'Referencia', 'Folio (Manual)', 'EXPEDIENTE',
  'Aseguradora', 'Tipo de servicio', 'Marca del vehículo', 'Tipo de vehículo',
  'Placas del vehículo', 'No. serie del vehículo (VIN)', 'Origen', 'Destino', 'Grúa',
  'Operador', 'Subtotal', 'Observaciones internas', 'Total',
];

const templateHeaders = legacyHeaders
  .filter((_, index) => index !== 1 && index !== 2)
  .map((header) => header === 'No. serie del vehículo (VIN)' ? 'No. serie del vehículo' : header);

const createLegacyFile = (dataRows: unknown[][], sheetName = 'Reporte') => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    [],
    ['', 'Reporte de memorias descriptivas'],
    [],
    ['', ...legacyHeaders],
    ...dataRows.map((row) => ['', ...row]),
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new File([bytes], 'legacy.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

const createTemplateFile = (dataRows: unknown[][]) => {
  const workbook = XLSX.utils.book_new();
  const templateRows = dataRows.map((row) => row.filter((_, index) => index !== 1 && index !== 2));
  const worksheet = XLSX.utils.aoa_to_sheet([templateHeaders, ...templateRows]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Servicios Legacy');
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new File([bytes], 'plantilla_servicios_legacy.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

const validRow = [
  '01/09/2020 09:15:30 a.\u00a0m.', 'Ajustador', 'REF-1', 'F-1', 'EXP-1',
  'Arrendadora Ajustes', 'Arrastre', 'Toyota', 'SUV', 'ABCD12', 'VIN1',
  'Origen', 'Destino', 'G-1', 'Sergio Iriarte', '30,000.00', 'Observación', '35,700.00',
];

describe('legacyServicesParser', () => {
  it('parses fixed Reporte rows, NBSP meridiem and CLP amounts', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const valid = [...validRow];
    const invalid = [...valid]; invalid[0] = 'fecha imposible'; invalid[3] = 'F-2';
    const rows = await parseLegacyServicesXLSX(createLegacyFile([valid, invalid]));
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("Archivo en formato legacy detectado (hoja 'Reporte'). Las columnas Ajustador y Referencia se omitirán automáticamente."));
    infoSpy.mockRestore();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ _rowIndex: 5, _invalidDate: false, manual_folio: 'F-1', subtotal_clp: 30000, total_clp: 35700 });
    expect(rows[0]).not.toHaveProperty('adjuster');
    expect(rows[0]).not.toHaveProperty('reference');
    expect(rows[0].received_at).toContain('2020-09-01T13:15:30');
    expect(rows[1]).toMatchObject({ _rowIndex: 6, _invalidDate: true, received_at: null });

    const stats = computeLegacyPreviewStats(rows);
    expect(stats).toMatchObject({ total_rows: 2, valid_rows: 1, invalid_rows: 1, invalid_row_numbers: [6], period_from: '2020-09-01', period_to: '2020-09-01', total_subtotal_clp: 30000, total_total_clp: 35700 });
  });

  it('parses the new Servicios Legacy template from row 1', async () => {
    const second = [...validRow]; second[3] = 'F-2'; second[9] = 'ZZZZ99';
    const rows = await parseLegacyServicesXLSX(createTemplateFile([validRow, second]));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ _rowIndex: 2, manual_folio: 'F-1', _invalidDate: false });
    expect(rows[1]).toMatchObject({ _rowIndex: 3, manual_folio: 'F-2', _invalidDate: false });
  });

  it('omits the template example only when it is immediately after the headers', async () => {
    const example = [...validRow];
    example[0] = '01/09/2020 12:08:00 p.\u00a0m.';
    example[3] = '2150';
    example[9] = 'JVWP-22';
    example[15] = '30,000.00';
    const laterRealRow = [...example];
    const rows = await parseLegacyServicesXLSX(createTemplateFile([example, validRow, laterRealRow]));
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row._rowIndex)).toEqual([3, 4]);
    expect(rows[1]).toMatchObject({ manual_folio: '2150', license_plate: 'JVWP-22', _isTemplateExample: false });

    const legacyRows = await parseLegacyServicesXLSX(createLegacyFile([example, validRow]));
    expect(legacyRows).toHaveLength(1);
    expect(legacyRows[0]).toMatchObject({ _rowIndex: 6, manual_folio: 'F-1' });
  });

  it('rejects files without the required sheet', async () => {
    await expect(parseLegacyServicesXLSX(createLegacyFile([], 'Otra'))).rejects.toThrow("No se encontró la hoja 'Servicios Legacy' ni 'Reporte' en el archivo.");
  });

  it('rejects a changed header', async () => {
    const file = createLegacyFile([]);
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    workbook.Sheets.Reporte.C4.v = 'Encabezado incorrecto';
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    await expect(parseLegacyServicesXLSX(new File([bytes], 'bad.xlsx'))).rejects.toThrow('Formato inválido');
  });

  it('normalizes deterministic text variants for analytics and preview', async () => {
    const rows = [
      ['01/09/2020 09:00:00 a. m.', 'Ajustador', 'REF-1', 'F-1', 'EXP-1', 'reale seguros', 'grua livianos', 'bmw', 'auto', 'lfxr-51', 'vin 1', ' Origen  Uno ', 'Destino Uno', 'lfxr-51', 'jorge iriarte', '30000', '  Observación  libre ', '35700'],
      ['01/09/2020 10:00:00 a. m.', 'Ajustador', 'REF-2', 'F-2', 'EXP-2', 'Reale Seguros', 'GRUA LIVIANO', 'BMW', 'AUTO', 'LFXR-51', 'VIN1', 'Origen Dos', 'Destino Dos', 'Clean Car', 'Jorge Iriarte', '30000', 'Texto MIXTO', '35700'],
      ['01/09/2020 11:00:00 a. m.', 'Ajustador', 'REF-3', 'F-3', 'EXP-3', 'Reale Seguros', 'grua liviano', 'chevrolet', 'camioneta', 'lfxr 51', 'vin 1', 'Origen Tres', 'Destino Tres', 'por tierra', 'JORGE IRIARTE', '30000', 'Otra Obs', '35700'],
      ['01/09/2020 12:00:00 p. m.', 'Ajustador', 'REF-4', 'F-4', 'EXP-4', 'reale seguros', 'apertura puertas', 'toyota', 'suv', 'abcd-12', 'vin 2', 'Origen Cuatro', 'Destino Cuatro', 'taxi', 'jorge iriarte', '30000', 'Obs', '35700'],
      ['01/09/2020 01:00:00 p. m.', 'Ajustador', 'REF-5', 'F-5', 'EXP-5', 'Reale Seguros', 'revision tecnica', 'volkswagen', 'sedan', 'wxyz-99', 'vin 3', 'Origen Cinco', 'Destino Cinco', 'ABCD-12', 'Jorge Iriarte', '30000', 'Obs', '35700'],
      ['01/09/2020 02:00:00 p. m.', 'Ajustador', 'REF-6', 'F-6', 'EXP-6', 'AXA Asistencia', 'cambio neumaticos', 'mercedes benz', 'furgon', 'lmno-88', 'vin 4', 'Origen Seis', 'Destino Seis', 'Clean Car', 'JORGE IRIARTE', '30000', 'Obs', '35700'],
    ];

    const parsedRows = await parseLegacyServicesXLSX(createTemplateFile(rows));
    expect(new Set(parsedRows.map((row) => row.operator_label))).toEqual(new Set(['Jorge Iriarte']));
    expect(new Set(parsedRows.slice(0, 5).map((row) => row.insurer))).toEqual(new Set(['Reale Seguros']));
    expect(parsedRows[5].insurer).toBe('AXA Asistencia');
    expect(parsedRows[0]).toMatchObject({
      service_type: 'Grua Liviano',
      vehicle_brand: 'BMW',
      license_plate: 'LFXR-51',
      vin: 'VIN1',
      origin: 'Origen Uno',
      observations: 'Observación libre',
    });
    expect(parsedRows[3].service_type).toBe('Apertura de Puertas');
    expect(parsedRows[4].service_type).toBe('Revisión Técnica');
    expect(parsedRows[5].service_type).toBe('Cambio de Neumáticos');

    const stats = computeLegacyPreviewStats(parsedRows);
    expect(stats.normalization_applied.operators_unified[0]).toMatchObject({
      after: 'Jorge Iriarte',
      before: expect.arrayContaining(['jorge iriarte', 'Jorge Iriarte', 'JORGE IRIARTE']),
    });
    expect(stats.normalization_applied.insurers_unified[0]).toMatchObject({
      after: 'Reale Seguros',
      before: expect.arrayContaining(['reale seguros', 'Reale Seguros']),
    });
  });
});
