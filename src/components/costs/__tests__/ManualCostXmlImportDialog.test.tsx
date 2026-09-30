import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FieldChangeRow } from '../ManualCostXmlImportDialog';
import type { ManualCostXmlFieldChange } from '@/services/manualCostXmlImport';
import type { Supplier } from '@/types/suppliers';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

afterEach(cleanup);

const change: ManualCostXmlFieldChange = {
  field: 'description', label: 'Descripción', currentValue: 'Entrega en La Serena',
  incomingValue: 'Asistencia Vial', source: 'current', finalValue: 'Entrega en La Serena', action: 'keep',
};

describe('personalización de campos XML', () => {
  it('permite elegir XML o personalizar desde un campo conservado', async () => {
    const onSelectionChange = vi.fn();
    render(<FieldChangeRow change={change} suppliers={[]} onSelectionChange={onSelectionChange} />);
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Qué guardar' }), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: 'Usar XML' }));
    expect(onSelectionChange).toHaveBeenCalledWith({ source: 'xml', value: 'Entrega en La Serena' });
  });

  it('permite editar la descripción y muestra el resultado', () => {
    const onSelectionChange = vi.fn();
    render(<FieldChangeRow change={{ ...change, source: 'custom', finalValue: 'Nueva entrega', action: 'overwrite' }}
      selection={{ source: 'custom', value: 'Nueva entrega' }} suppliers={[]} onSelectionChange={onSelectionChange} />);
    fireEvent.change(screen.getByLabelText('Valor personalizado'), { target: { value: 'Servicio personalizado' } });
    expect(onSelectionChange).toHaveBeenCalledWith({ source: 'custom', value: 'Servicio personalizado' });
    expect(screen.getByText('Nueva entrega', { selector: 'p' })).toBeInTheDocument();
  });

  it('muestra nombres de proveedores y permite elegir uno del sistema', async () => {
    const onSelectionChange = vi.fn();
    render(<FieldChangeRow change={{ ...change, field: 'supplier_id', label: 'Proveedor', currentValue: 'supplier-1',
      incomingValue: 'supplier-2', source: 'custom', finalValue: 'supplier-1' }}
      selection={{ source: 'custom', value: 'supplier-1' }}
      suppliers={[{ id: 'supplier-1', name: 'Gruas ALS' }, { id: 'supplier-2', name: 'Proveedor XML' }] as Supplier[]}
      xmlSupplierName="Proveedor XML" onSelectionChange={onSelectionChange} />);
    expect(screen.queryByText('supplier-1')).not.toBeInTheDocument();
    expect(screen.queryByText('supplier-2')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Valor personalizado' }), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: 'Proveedor XML' }));
    expect(onSelectionChange).toHaveBeenCalledWith({ source: 'custom', value: 'supplier-2' });
  });
});
