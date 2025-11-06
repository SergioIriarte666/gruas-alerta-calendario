import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, ArrowUpDown, Settings2 } from 'lucide-react';
import { useIncomeCategoryManager, IncomeCategory } from '@/hooks/useIncomeCategoryManager';
import { IncomeCategoryForm } from './IncomeCategoryForm';
import { IncomeSubcategoryManager } from './IncomeSubcategoryManager';

type SortField = 'name' | 'description';
type SortDirection = 'asc' | 'desc';

const SortIcon = ({ field, currentField, direction }: { field: SortField; currentField: SortField; direction: SortDirection }) => {
  if (field !== currentField) return <ArrowUpDown className="w-4 h-4 text-muted-foreground" />;
  return <ArrowUpDown className={`w-4 h-4 ${direction === 'asc' ? 'rotate-180' : ''}`} />;
};

export const IncomeCategoryList = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<IncomeCategory | undefined>();
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [managingSubcategories, setManagingSubcategories] = useState<IncomeCategory | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const { categories, isLoading, deleteCategory, isDeleting } = useIncomeCategoryManager();

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const aValue = a[sortField] || '';
      const bValue = b[sortField] || '';
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [categories, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleEdit = (category: IncomeCategory) => {
    setEditingCategory(category);
    setShowForm(true);
  };

  const handleDelete = () => {
    if (deletingCategoryId) {
      deleteCategory(deletingCategoryId);
      setDeletingCategoryId(null);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingCategory(undefined);
  };

  const handleManageSubcategories = (category: IncomeCategory) => {
    setManagingSubcategories(category);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Cargando categorías...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Gestión de Categorías de Ingresos</CardTitle>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Categoría
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay categorías de ingresos. Crea una nueva para comenzar.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th 
                      className="text-left p-3 font-medium cursor-pointer hover:bg-muted/80"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        Nombre
                        <SortIcon field="name" currentField={sortField} direction={sortDirection} />
                      </div>
                    </th>
                    <th 
                      className="text-left p-3 font-medium cursor-pointer hover:bg-muted/80"
                      onClick={() => handleSort('description')}
                    >
                      <div className="flex items-center gap-2">
                        Descripción
                        <SortIcon field="description" currentField={sortField} direction={sortDirection} />
                      </div>
                    </th>
                    <th className="text-center p-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCategories.map((category) => (
                    <tr key={category.id} className="border-t hover:bg-muted/50">
                      <td className="p-3 font-medium">{category.name}</td>
                      <td className="p-3 text-muted-foreground">
                        {category.description || '-'}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleManageSubcategories(category)}
                            title="Gestionar subcategorías"
                          >
                            <Settings2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(category)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingCategoryId(category.id)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={handleFormClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
            </DialogTitle>
          </DialogHeader>
          <IncomeCategoryForm
            category={editingCategory}
            onSuccess={handleFormClose}
            onCancel={handleFormClose}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!managingSubcategories} onOpenChange={() => setManagingSubcategories(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Subcategorías</DialogTitle>
          </DialogHeader>
          {managingSubcategories && (
            <IncomeSubcategoryManager
              category={managingSubcategories}
              onClose={() => setManagingSubcategories(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingCategoryId} onOpenChange={() => setDeletingCategoryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La categoría y todas sus subcategorías serán eliminadas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
