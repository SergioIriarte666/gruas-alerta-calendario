import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSuppliers } from '@/hooks/useSuppliers';
import { SupplierFormData } from '@/types/suppliers';
import { Plus, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { formatRut } from '@/utils/rutFormatter';
import { createLogger } from "@/lib/logger";


const logger = createLogger("QuickSupplierModal");
interface QuickSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (supplierId: string) => void;
}

export const QuickSupplierModal: React.FC<QuickSupplierModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const [name, setName] = useState('');
  const [rut, setRut] = useState('');
  const { createSupplierAsync, isCreating } = useSuppliers();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('El nombre del proveedor es requerido');
      return;
    }

    try {
      const data = await createSupplierAsync({ 
        name: name.trim(), 
        rut: rut.trim() || undefined,
        category: 'general',
        is_active: true 
      } as SupplierFormData);
      
      onSuccess(data.id);
      setName('');
      setRut('');
      onClose();
    } catch (error: any) {
      const errorMessage = error?.message || '';
      if (errorMessage.includes('suppliers_rut_key') || errorMessage.includes('duplicate key')) {
        toast.error('Ya existe un proveedor con este RUT');
      } else {
        toast.error('Error al crear proveedor');
      }
      logger.error(error);
    }
  };

  const handleClose = () => {
    setName('');
    setRut('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="supplier-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            Crear Proveedor Rápido
          </DialogTitle>
          <DialogDescription>
            Complete los datos básicos. Puede editar más información en el módulo de Proveedores.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="supplier-name">
              Nombre del Proveedor <span className="text-destructive">*</span>
            </Label>
            <Input
              id="supplier-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej: Repuestos del Sur S.A."
              disabled={isCreating}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier-rut">RUT (Opcional)</Label>
            <Input
              id="supplier-rut"
              value={rut}
              onChange={(e) => setRut(formatRut(e.target.value))}
              placeholder="ej: 76.123.456-7"
              disabled={isCreating}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isCreating || !name.trim()}
            >
              {isCreating ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="size-4 mr-2" />
                  Crear Proveedor
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
