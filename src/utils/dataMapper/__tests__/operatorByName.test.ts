import { describe, expect, it } from 'vitest';
import type { Client, Crane, Operator, ServiceType } from '@/types';
import { EntityFinders } from '@/utils/dataMapper/entityFinders';
import { HeaderMapper } from '@/utils/dataMapper/headerMapping';
import { RowMapper } from '@/utils/dataMapper/rowMapper';
import { DataValidators } from '@/utils/dataMapper/dataValidators';

const operator = (name: string, rut: string): Operator => ({
  id: `op-${rut}`, name, rut, phone: '', operatorType: 'crane_operator', isActive: true, createdAt: '', updatedAt: '',
});
const client: Client = {
  id: 'cli-1', name: 'Minera Zaldívar', rut: '76.123.456-7', phone: '', email: '', address: '',
  department: 'Mantención', isActive: true, createdAt: '', updatedAt: '',
};
const crane = { id: 'cr-1', licensePlate: 'ABCD12', brand: 'Volvo', model: 'FH', type: 'pesada', isActive: true } as unknown as Crane;
const serviceType = { id: 'st-1', name: 'Traslado', isActive: true } as unknown as ServiceType;

const finders = new EntityFinders(
  [client], [crane],
  [operator('Juan Pérez', '11.111.111-1'), operator('Juan Soto', '22.222.222-2'), operator('María Ángeles', '33.333.333-3')],
  [serviceType],
);

describe('EntityFinders.findOperatorByName', () => {
  it('encuentra por igualdad exacta sin importar mayúsculas ni acentos', () => {
    expect(finders.findOperatorByName('juan perez')?.rut).toBe('11.111.111-1');
    expect(finders.findOperatorByName('  MARÍA ANGELES ')?.rut).toBe('33.333.333-3');
  });

  it('acepta la etiqueta con RUT de la plantilla ("Nombre (RUT)") por contención única', () => {
    expect(finders.findOperatorByName('María Ángeles (33.333.333-3)')?.rut).toBe('33.333.333-3');
  });

  it('no adivina cuando la contención es ambigua ni con texto vacío', () => {
    expect(finders.findOperatorByName('Juan')).toBeNull();
    expect(finders.findOperatorByName('')).toBeNull();
    expect(finders.findOperatorByName('Nadie')).toBeNull();
  });
});

describe('HeaderMapper con "Operador Nombre"', () => {
  it('lo mapea a operatorName y no lo reporta como columna no reconocida', () => {
    const mapper = new HeaderMapper();
    expect(mapper.mapHeaders(['Operador Nombre', 'OPERADOR NOMBRE', 'operador nombre'])).toEqual(['operatorName', 'operatorName', 'operatorName']);
    const result = mapper.validateHeaders([
      'Folio', 'Fecha Solicitud', 'Fecha Servicio', 'Cliente RUT', 'Cliente Nombre', 'Cliente Departamento',
      'Vehículo Marca', 'Vehículo Modelo', 'Patente', 'Origen', 'Destino', 'Tipo Servicio', 'Valor',
      'Grúa Patente', 'Operador RUT', 'Comisión Operador', 'Observaciones', 'Combustible', 'Viaticos', 'Peajes',
      'Operador Nombre',
    ]);
    expect(result.valid).toBe(true);
    expect(result.extra).toEqual([]);
  });
});

describe('RowMapper: operador por nombre cuando el RUT viene vacío', () => {
  const rowMapper = new RowMapper(finders, new DataValidators());
  const baseRow = {
    folio: 'SRV-7021', requestDate: '2026-09-01', serviceDate: '2026-09-02',
    clientRut: '76.123.456-7', clientName: 'Minera Zaldívar', clientDepartment: 'Mantención',
    vehicleBrand: 'Toyota', vehicleModel: 'Hilux', licensePlate: 'XYZW99', origin: 'A', destino: 'B', destination: 'B',
    serviceType: 'Traslado', value: '100000', craneLicensePlate: 'ABCD12', operatorCommission: '',
  };

  it('resuelve el operador por nombre y lo deja como advertencia', async () => {
    const result = await rowMapper.mapRowData({ ...baseRow, operatorRut: '', operatorName: 'Juan Soto' });
    expect(result.success).toBe(true);
    expect(result.data?.operatorId).toBe('op-22.222.222-2');
    expect(result.warnings?.join(' ')).toMatch(/resuelto por nombre/);
  });

  it('con RUT presente manda el RUT y no cae al nombre', async () => {
    const result = await rowMapper.mapRowData({ ...baseRow, operatorRut: '11.111.111-1', operatorName: 'Juan Soto' });
    expect(result.success).toBe(true);
    expect(result.data?.operatorId).toBe('op-11.111.111-1');
  });

  it('con RUT desconocido no cae al nombre y reporta el RUT', async () => {
    const result = await rowMapper.mapRowData({ ...baseRow, operatorRut: '99.999.999-9', operatorName: 'Juan Soto' });
    expect(result.success).toBe(false);
    expect(result.errors.join(' ')).toContain('Operador no encontrado: 99.999.999-9');
  });

  it('sin RUT ni nombre válido reporta error', async () => {
    const result = await rowMapper.mapRowData({ ...baseRow, operatorRut: '', operatorName: 'Nadie' });
    expect(result.success).toBe(false);
    expect(result.errors.join(' ')).toContain('Operador no encontrado: Nadie');
  });
});
