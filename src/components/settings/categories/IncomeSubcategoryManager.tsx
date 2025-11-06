import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus } from 'lucide-react';
import { IncomeCategory } from '@/hooks/useIncomeCategoryManager';
import { useIncomeSubcategories } from '@/hooks/useIncomeSubcategories';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface IncomeSubcategoryManagerProps {
  category: IncomeCategory;
  onClose: () => void;
}

export const IncomeSubcategoryManager = ({ category, onClose }: IncomeSubcategoryManagerProps) => {
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const {
    allSubcategories,
    isLoadingAll,
    createSubcategory,
    deleteSubcategory,
    toggleSubcategoryStatus,
    isCreating,
    isDeleting,
    isToggling,
  } = useIncomeSubcategories(category.id);

  const handleAdd = () => {
    if (!newSubcategoryName.trim()) return;
    
    const maxOrder = Math.max(0, ...allSubcategories.map(s => s.display_order));
    
    createSubcategory({
      category_id: category.id,
      name: newSubcategoryName.trim(),
      display_order: maxOrder + 1,
    });
    
    setNewSubcategoryName('');
  };

  const handleDelete = (id: string) => {
    deleteSubcategory(id);
    setDeleteConfirmId(null);
  };

  const handleToggleStatus = (id: string, currentStatus: boolean) => {
    toggleSubcategoryStatus({ id, is_active: !currentStatus });
  };

  if (isLoadingAll) {
    return <div className="text-center py-4">Cargando subcategorías...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">
          Gestionar Subcategorías de: {category.name}
        </h3>
        
        <div className="space-y-2 mb-4">
          <Label>Nueva Subcategoría</Label>
          <div className="flex gap-2">
            <Input
              value={newSubcategoryName}
              onChange={(e) => setNewSubcategoryName(e.target.value)}
              placeholder="Nombre de la subcategoría"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <Button 
              onClick={handleAdd} 
              disabled={!newSubcategoryName.trim() || isCreating}
              size="icon"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 font-medium">Nombre</th>
                <th className="text-center p-3 font-medium">Estado</th>
                <th className="text-center p-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {allSubcategories.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-muted-foreground">
                    No hay subcategorías. Agrega una nueva arriba.
                  </td>
                </tr>
              ) : (
                allSubcategories.map((sub) => (
                  <tr key={sub.id} className="border-t">
                    <td className="p-3">{sub.name}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={sub.is_active}
                          onCheckedChange={() => handleToggleStatus(sub.id, sub.is_active)}
                          disabled={isToggling}
                        />
                        <span className="text-sm text-muted-foreground">
                          {sub.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmId(sub.id)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onClose}>Cerrar</Button>
      </div>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar subcategoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La subcategoría será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
