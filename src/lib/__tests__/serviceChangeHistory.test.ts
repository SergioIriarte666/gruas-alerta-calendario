import { describe, expect, it } from 'vitest';
import {
  isMeaningfulServiceChange,
  isServiceItemField,
  serviceChangeIdentity,
} from '@/lib/serviceChangeHistory';

const update = (fieldName: string, oldValue: string | null, newValue: string | null) => ({
  changeType: 'UPDATE',
  fieldName,
  oldValue,
  newValue,
});

describe('isMeaningfulServiceChange', () => {
  it('oculta cambios heredados entre NULL y texto vacío', () => {
    expect(isMeaningfulServiceChange(update('custody_notes', null, ''))).toBe(false);
    expect(isMeaningfulServiceChange(update('quote_number', '', null))).toBe(false);
  });

  it('oculta NULL contra cero en campos cuyo valor funcional por defecto es cero', () => {
    expect(isMeaningfulServiceChange(update('custody_discount_percentage', null, '0'))).toBe(false);
    expect(isMeaningfulServiceChange(update('operator_commission', '0.00', '0'))).toBe(false);
  });

  it('mantiene cambios reales de patente y folio', () => {
    expect(isMeaningfulServiceChange(update('license_plate', 'ABCD12', 'WXYZ34'))).toBe(true);
    expect(isMeaningfulServiceChange(update('folio', '100-1', '100-2'))).toBe(true);
  });

  it('mantiene cambios desde vacío hacia un valor real', () => {
    expect(isMeaningfulServiceChange(update('license_plate', null, 'ABCD12'))).toBe(true);
  });

  it('mantiene los eventos que no son modificaciones', () => {
    expect(isMeaningfulServiceChange({
      changeType: 'CREATE',
      fieldName: 'servicio',
      oldValue: null,
      newValue: null,
    })).toBe(true);
  });
});

describe('service change audit helpers', () => {
  it('distingue los campos de ítems de la creación del servicio', () => {
    expect(isServiceItemField('Item: Traslado')).toBe(true);
    expect(isServiceItemField('servicio')).toBe(false);
  });

  it('genera la misma identidad para filas duplicadas del mismo evento', () => {
    const base = {
      eventId: 'event-1',
      serviceId: 'service-1',
      changeType: 'CREATE',
      fieldName: 'servicio',
      oldValue: null,
      newValue: null,
    };

    expect(serviceChangeIdentity({ ...base, id: 'row-1' }))
      .toBe(serviceChangeIdentity({ ...base, id: 'row-2' }));
  });

  it('no mezcla filas antiguas sin event_id', () => {
    const base = {
      eventId: null,
      serviceId: 'service-1',
      changeType: 'CREATE',
      fieldName: 'servicio',
      oldValue: null,
      newValue: null,
    };

    expect(serviceChangeIdentity({ ...base, id: 'row-1' }))
      .not.toBe(serviceChangeIdentity({ ...base, id: 'row-2' }));
  });
});
