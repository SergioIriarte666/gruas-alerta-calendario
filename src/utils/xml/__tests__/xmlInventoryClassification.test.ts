import { describe, expect, it } from 'vitest';
import { resolveLineSubcategoryId, summarizeInvoiceClassifications } from '../xmlInventoryClassification';

const options = [{ id: 'parts', name: 'Partes y Piezas' }, { id: 'tools', name: 'Herramientas' }, { id: 'supplies', name: 'Consumibles' }];

describe('subcategoría por producto XML', () => {
  it('usa la general salvo selección propia y permite quitarla expresamente', () => {
    expect(resolveLineSubcategoryId(undefined, 'Partes y Piezas', options)).toBe('parts');
    expect(resolveLineSubcategoryId('tools', 'Partes y Piezas', options)).toBe('tools');
    expect(resolveLineSubcategoryId('', 'Partes y Piezas', options)).toBeNull();
    expect(resolveLineSubcategoryId(undefined, 'No existe', options)).toBeNull();
  });

  it('resume los tres productos del XML sin duplicar el costo ni distribuir el IVA', () => {
    const groups = summarizeInvoiceClassifications([
      { cost_subcategory: 'Partes y Piezas', subtotal: 173076 },
      { cost_subcategory: 'Consumibles', subtotal: 1756 },
      { cost_subcategory: 'Herramientas', subtotal: 12597 },
    ]);
    expect(groups).toEqual([
      { name: 'Partes y Piezas', lineCount: 1, netAmount: 173076 },
      { name: 'Consumibles', lineCount: 1, netAmount: 1756 },
      { name: 'Herramientas', lineCount: 1, netAmount: 12597 },
    ]);
    expect(groups.reduce((sum, group) => sum + group.netAmount, 0)).toBe(187429);
  });

  it('agrupa productos iguales y distingue sin subcategoría explícita de registros anteriores', () => {
    expect(summarizeInvoiceClassifications([
      { cost_subcategory: 'Herramientas', subtotal: '100' },
      { cost_subcategory: 'Herramientas', subtotal: 50 },
      { cost_subcategory: '', subtotal: 20 },
      { cost_subcategory: null, subtotal: 10 },
    ], 'Partes y Piezas')).toEqual([
      { name: 'Herramientas', lineCount: 2, netAmount: 150 },
      { name: 'Sin subcategoría', lineCount: 1, netAmount: 20 },
      { name: 'Partes y Piezas', lineCount: 1, netAmount: 10 },
    ]);
  });
});
