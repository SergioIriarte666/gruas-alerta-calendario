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
import { useCostCategories } from '@/hooks/useCostCategories';

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
  const { data: costCategoriesData = [] } = useCostCategories();
  const activeCategories = costCategoriesData.map(c => ({ id: c.id, label: c.name, name: c.name }));

  const [category, setCategory] = useState<string>('no_change');
  const [status, setStatus] = useState<string>('no_change');

  const updateSuppliersMutation = useMutation({
    mutationFn: async () => {
      const updates: any = {};
      
      if (category !== 'no_change') {
        // Find the category name corresponding to the ID if needed, 
        // but based on Supplier type, category is a string (name or id depending on implementation).
        // Looking at SupplierList, it seems to store the category name directly in some places 
        // or the ID. Let's assume ID is correct as per schema, but if it stores name, we might need to change.
        // In SupplierList: value={category.name}, so it seems to store the name?
        // Let's check the SelectItem in this file: value={cat.id}.
        // If the DB expects name, we should send name. If it expects UUID, send UUID.
        // Given `activeCategories` map: id -> id, label -> name, name -> name.
        // Let's assume we should send the name if the previous implementation used names.
        // Checking SupplierList again: value={category.name}. So it stores names.
        
        const selectedCat = activeCategories.find(c => c.id === category);
        if (selectedCat) {
            updates.category = selectedCat.name; 
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
          .from('suppliers')
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
      console.error('Error updating suppliers:', error);
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
      <DialogContent className="sm:max-w-[425px]">
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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
