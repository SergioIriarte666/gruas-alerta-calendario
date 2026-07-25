import { describe, expect, it, vi } from 'vitest';
import {
  EnhancedCSVUploader,
  isMissingRequiredValue,
  normalizeExcelCellValue,
} from '@/utils/enhancedCsvUpload';
import type { MappedServiceData } from '@/utils/dataMapper';

describe('normalizeExcelCellValue', () => {
  it('converts numeric serials only in date columns', () => {
    expect(normalizeExcelCellValue('Fecha Servicio', 46226)).toBe('2026-07-23');
    expect(normalizeExcelCellValue('Fecha Solicitud', 46225)).toBe('2026-07-22');
  });

  it('preserves monetary values and zero commissions as numbers', () => {
    expect(normalizeExcelCellValue('Valor', 40000)).toBe(40000);
    expect(normalizeExcelCellValue('Comisión Operador', 0)).toBe(0);
  });

  it('does not reinterpret date-like text outside date columns', () => {
    expect(normalizeExcelCellValue('Observaciones', '2026-07-23')).toBe('2026-07-23');
  });

  it('accepts zero as a provided numeric value', () => {
    expect(isMissingRequiredValue(0)).toBe(false);
    expect(isMissingRequiredValue('0')).toBe(false);
    expect(isMissingRequiredValue('')).toBe(true);
  });

  it('stops creating remaining services when the upload is cancelled', async () => {
    const uploader = new EnhancedCSVUploader();
    const services: MappedServiceData[] = ['SRV-001', 'SRV-002'].map(folio => ({
      folio,
      requestDate: '2026-07-24',
      serviceDate: '2026-07-24',
      clientId: 'client-1',
      vehicleBrand: 'Suzuki',
      vehicleModel: 'Carry',
      licensePlate: 'ABCD-12',
      origin: 'Origen',
      destination: 'Destino',
      serviceTypeId: 'type-1',
      value: 40000,
      craneId: 'crane-1',
      operatorId: 'operator-1',
      operatorCommission: 0,
      observations: '',
    }));

    let finishFirstService: (() => void) | undefined;
    const createService = vi.fn(() => new Promise<void>(resolve => {
      finishFirstService = resolve;
    }));

    const uploadPromise = uploader.uploadServices(services, createService);
    await vi.waitFor(() => expect(createService).toHaveBeenCalledTimes(1));

    uploader.cancelUpload();
    finishFirstService?.();

    const result = await uploadPromise;

    expect(result.cancelled).toBe(true);
    expect(result.processed).toBe(1);
    expect(createService).toHaveBeenCalledTimes(1);
  });
});
