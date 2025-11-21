import React, { useState } from 'react';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UseFormReturn } from 'react-hook-form';
import { useSuppliers } from '@/hooks/useSuppliers';
import { QuickSupplierModal } from '@/components/suppliers/QuickSupplierModal';
import { Building2, Plus } from 'lucide-react';

interface SupplierSelectorProps {
  form: UseFormReturn<any>;
  fieldName?: string;
  label?: string;
  placeholder?: string;
}

export const SupplierSelector: React.FC<SupplierSelectorProps> = ({ 
  form,
  fieldName = 'supplier_id',
  label = 'Proveedor',
  placeholder = 'Seleccionar proveedor'
}) => {
  const { suppliers, isLoading } = useSuppliers();
  const [showQuickModal, setShowQuickModal] = useState(false);

  const handleSupplierCreated = (supplierId: string) => {
    form.setValue(fieldName, supplierId);
    setShowQuickModal(false);
  };

  return (
    <>
      <FormField
        name={fieldName}
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <Label className="flex items-center gap-2 text-foreground">
              <Building2 className="w-4 h-4" />
              {label}
            </Label>
            <FormControl>
              <Select
                value={field.value || 'none'}
                onValueChange={(value) => {
                  if (value === 'new_supplier') {
                    setShowQuickModal(true);
                  } else if (value === 'none') {
                    field.onChange(null);
                  } else {
                    field.onChange(value);
                  }
                }}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin proveedor</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{supplier.name}</span>
                        {supplier.rut && (
                          <span className="text-xs text-muted-foreground">RUT: {supplier.rut}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="new_supplier">
                    <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 font-medium">
                      <Plus className="h-4 w-4" />
                      Crear nuevo proveedor...
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <QuickSupplierModal
        isOpen={showQuickModal}
        onClose={() => setShowQuickModal(false)}
        onSuccess={handleSupplierCreated}
      />
    </>
  );
};