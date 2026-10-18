import { describe, expect, it } from 'vitest';
import { findSupplierByIdentity, supplierRutVariants } from '../supplierIdentity';

describe('Identidad del proveedor por RUT del emisor', () => {
  const suppliers = [{ id: 'own', name: 'Grúas 5 Norte SpA', rut: '76.769.841-0' }, { id: 'rio', name: 'Comercializadora Rio Copiapo Spa', rut: '77.084.699-4' }];
  it('el RUT prevalece aunque el nombre leído sea el del receptor', () => {
    expect(findSupplierByIdentity(suppliers, { name: 'Grúas 5 Norte SpA', rut: '77084699-4' })?.id).toBe('rio');
  });
  it('no reutiliza por nombre otro RUT cuando el emisor no existe', () => {
    expect(findSupplierByIdentity([suppliers[0]], { name: 'Grúas 5 Norte SpA', rut: '77.084.699-4' })).toBeUndefined();
  });
  it('conserva la búsqueda por nombre únicamente si no se proporcionó RUT', () => {
    expect(findSupplierByIdentity(suppliers, { name: 'Gruas 5 Norte SpA', rut: '' })?.id).toBe('own');
  });
  it('consulta variantes de formato sin cambiar los dígitos ni el verificador', () => {
    expect(supplierRutVariants('77.084.699-4')).toEqual(expect.arrayContaining(['77.084.699-4', '77084699-4', '770846994']));
    expect(supplierRutVariants('77.084.699-4')).not.toContain('76.769.841-0');
  });
});
