import { describe, expect, it, vi } from 'vitest';
import {
  EnhancedCSVUploader,
  isMissingRequiredValue,
  normalizeExcelCellValue,
} from '@/utils/enhancedCsvUpload';
import type { MappedServiceData } from '@/utils/dataMapper';
import { DataValidators } from '@/utils/dataMapper/dataValidators';
import { HeaderMapper } from '@/utils/dataMapper/headerMapping';
import { RowMapper } from '@/utils/dataMapper/rowMapper';

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

  it('recognizes the optional service expense columns', () => {
    const mapper = new HeaderMapper();
    const validation = mapper.validateHeaders([
      'Folio', 'Fecha Solicitud', 'Fecha Servicio', 'Cliente RUT', 'Cliente Nombre',
      'Cliente Departamento', 'Vehículo Marca', 'Vehículo Modelo', 'Patente', 'Origen',
      'Destino', 'Tipo Servicio', 'Valor', 'Grúa Patente', 'Operador RUT',
      'Comisión Operador', 'Observaciones', 'Combustible', 'Viaticos', 'Peajes',
    ]);

    expect(validation.valid).toBe(true);
    expect(validation.extra).toEqual([]);
  });

  it('maps only positive optional expenses to service costs', async () => {
    const entityFinders = {
      findClientByRutAndDepartment: () => ({ id: 'client-1', name: 'Cliente', department: 'General', rut: '1-9' }),
      findClientByRut: () => ({ id: 'client-1', name: 'Cliente', department: 'General', rut: '1-9' }),
      findClientByName: () => null,
      findCraneByPlate: () => ({ id: 'crane-1', brand: 'Marca', model: 'Modelo' }),
      findOperatorByRut: () => ({ id: 'operator-1', name: 'Operador' }),
      findServiceTypeByName: () => ({ id: 'type-1', name: 'Grúa Livianos' }),
    };
    const mapper = new RowMapper(entityFinders as any, new DataValidators());
    const result = await mapper.mapRowData({
      folio: 'SRV-001',
      requestDate: '2026-09-09',
      serviceDate: '2026-09-09',
      clientRut: '1-9',
      clientName: 'Cliente',
      clientDepartment: 'General',
      vehicleBrand: 'Ford',
      vehicleModel: 'Ranger',
      licensePlate: 'ABCD-12',
      origin: 'Origen',
      destination: 'Destino',
      serviceType: 'Grúa Livianos',
      value: 450000,
      craneLicensePlate: 'TLYF-23',
      operatorRut: '1-9',
      operatorCommission: '',
      observations: '',
      fuelExpense: 150000,
      allowanceExpense: 15000,
      tollExpense: 10400,
    });

    expect(result.success).toBe(true);
    expect(result.data?.operatorCommission).toBe(0);
    expect(result.data?.costDetails).toEqual([
      expect.objectContaining({ subcategory: 'Combustible', amount: 150000 }),
      expect.objectContaining({
        subcategory: 'Viáticos',
        amount: 15000,
        operator_id: 'operator-1',
      }),
      expect.objectContaining({
        subcategory: 'Peajes',
        amount: 10400,
        location_text: 'Origen → Destino',
      }),
    ]);
  });

  it('rejects invalid or negative optional expense amounts', () => {
    const validators = new DataValidators();

    expect(validators.validateOptionalExpense('', 'Combustible')).toEqual({ isValid: true });
    expect(validators.validateOptionalExpense(0, 'Combustible')).toEqual({ isValid: true, amount: 0 });
    expect(validators.validateOptionalExpense(-1, 'Combustible').isValid).toBe(false);
    expect(validators.validateOptionalExpense('abc', 'Peajes').isValid).toBe(false);
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

  it('passes mapped expenses to service creation and marks them as paid', async () => {
    const uploader = new EnhancedCSVUploader();
    const service: MappedServiceData = {
      folio: 'SRV-003',
      requestDate: '2026-09-09',
      serviceDate: '2026-09-09',
      clientId: 'client-1',
      vehicleBrand: 'Ford',
      vehicleModel: 'Ranger',
      licensePlate: 'ABCD-12',
      origin: 'Origen',
      destination: 'Destino',
      serviceTypeId: 'type-1',
      value: 450000,
      craneId: 'crane-1',
      operatorId: 'operator-1',
      operatorCommission: 0,
      observations: '',
      costDetails: [{
        description: 'Combustible SRV-003',
        amount: 150000,
        quantity: 1,
        unitPrice: 150000,
        notes: 'Costo registrado desde carga masiva',
        subcategory: 'Combustible',
      }],
    };
    const createService = vi.fn().mockResolvedValue(undefined);

    const result = await uploader.uploadServices([service], createService);

    expect(result.success).toBe(true);
    expect(createService).toHaveBeenCalledWith(expect.objectContaining({
      costDetails: service.costDetails,
      markCostsPaidOnCreate: true,
    }));
  });
});
