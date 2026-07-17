import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { SupplierWithStats } from '@/types/suppliers';
import { useSupplierCategories } from '@/hooks/useSupplierCategories';
import { createLogger } from "@/lib/logger";


const logger = createLogger("BatchEditSuppliersModal");
interface BatchEditSuppliersModalProps {
  selectedSuppliers: SupplierWithStats[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const BatchEditSuppliersModal = ({
  selectedSuppliers,
  isOpen,
  onClose,
  onSuccess,
}: BatchEditSuppliersModalProps) => {
  const queryClient = useQueryClient();
  const { data: supplierCategoriesData = [] } = useSupplierCategories();
  const activeCategories = supplierCategoriesData.filter(c => c.is_active).map(c => ({ id: c.id, name: c.label || c.name }));

  const [category, setCategory] = useState<string>('no_change');
  const [status, setStatus] = useState<string>('no_change');

  const updateSuppliersMutation = useMutation({
    mutationFn: async () => {
      const updates: any = {};
      
      if (category !== 'no_change') {
        const selectedCat = activeCategories.find(c => c.id === category);
        if (selectedCat) {
            updates.category = selectedCat.id; 
        } else {
            updates.category = category; // Fallback
        }
      }
      
      if (status !== 'no_change') {
        updates.is_active = status === 'active';
      }

      if (Object.keys(updates).length === 0) {
        return;
      }

      const promises = selectedSuppliers.map(supplier => 
        supabase
          .from('inventory_suppliers')
          .update(updates)
          .eq('id', supplier.id)
          .then(({ error }) => {
            if (error) throw error;
          })
      );

      await Promise.all(promises);
    },
    onSuccess: () => {
      toast.success(`${selectedSuppliers.length} proveedores actualizados correctamente`);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      onSuccess?.();
      onClose();
      // Reset form
      setCategory('no_change');
      setStatus('no_change');
    },
    onError: (error) => {
      logger.error('Error updating suppliers:', error);
      toast.error('Error al actualizar proveedores');
    },
  });

  const handleSave = () => {
    if (category === 'no_change' && status === 'no_change') {
      onClose();
      return;
    }
    updateSuppliersMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="supplier-dialog sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edición Masiva de Proveedores</DialogTitle>
          <DialogDescription>
            Modificando {selectedSuppliers.length} proveedores seleccionados.
            Los campos que dejes como "Sin cambios" mantendrán su valor actual.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">
              Categoría
            </Label>
            <div className="col-span-3">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_change">-- Sin cambios --</SelectItem>
                  {activeCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">
              Estado
            </Label>
            <div className="col-span-3">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_change">-- Sin cambios --</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={updateSuppliersMutation.isPending || (category === 'no_change' && status === 'no_change')}
          >
            {updateSuppliersMutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
