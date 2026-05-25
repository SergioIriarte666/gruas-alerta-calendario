import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2, Plus, Settings, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useCostCategoryManager } from '@/hooks/useCostCategoryManager';
import { CostCategory } from '@/types/costs';
import { CostCategoryForm } from './CostCategoryForm';
import { CostSubcategoryManager } from './CostSubcategoryManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useIsMobile } from '@/hooks/use-mobile';

type CategorySortField = 'name' | 'description';
type SortDirection = 'asc' | 'desc';

const SortIcon = ({ field, currentSortField, sortDirection }: { 
  field: CategorySortField; 
  currentSortField?: CategorySortField; 
  sortDirection?: SortDirection 
}) => {
  if (currentSortField !== field) {
    return <ArrowUpDown className="ml-2 size-4 text-muted-foreground" />;
  }
  return sortDirection === 'asc' ? 
    <ArrowUp className="ml-2 size-4 text-primary" /> : 
    <ArrowDown className="ml-2 size-4 text-primary" />;
};

export const CostCategoryList = () => {
  const isMobile = useIsMobile();
  const {
    categories,
    isLoading,
    deleteCategory,
    isDeleting
  } = useCostCategoryManager();

  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CostCategory | null>(null);
  const [managingSubcategories, setManagingSubcategories] = useState<CostCategory | null>(null);
  const [sortField, setSortField] = useState<CategorySortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: CategorySortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'description': {
          const descA = a.description || '';
          const descB = b.description || '';
          comparison = descA.localeCompare(descB);
          break;
        }
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [categories, sortField, sortDirection]);

  const handleEdit = (category: CostCategory) => {
    setEditingCategory(category);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingCategory(null);
  };

  const handleDelete = (categoryId: string) => {
    deleteCategory(categoryId);
  };

  const handleManageSubcategories = (category: CostCategory) => {
    setManagingSubcategories(category);
  };

  const handleCloseSubcategoriesManager = () => {
    setManagingSubcategories(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Cargando categorías...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">Categorías de Costos</CardTitle>
          <Button 
            onClick={() => setShowForm(true)}
            className="gap-2"
            size={isMobile ? "sm" : "default"}
          >
            <Plus className="size-4" />
            {isMobile ? "Nueva" : "Nueva Categoría"}
          </Button>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay categorías registradas
            </div>
          ) : isMobile ? (
            /* Mobile Card View */
            <div className="space-y-3">
              {sortedCategories.map((category) => (
                <Card key={category.id} className="border bg-card">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm">{category.name}</p>
                        {category.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{category.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => handleManageSubcategories(category)} title="Subcategorías">
                          <Settings className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => handleEdit(category)}>
                          <Edit className="size-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8 text-destructive">
                              <Trash2 className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="w-[90vw] max-w-md">
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
                              <AlertDialogDescription>Se eliminará "{category.name}" y todas sus subcategorías.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(category.id)} disabled={isDeleting} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* Desktop Table */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer hover:text-primary" onClick={() => handleSort('name')}>
                    <div className="flex items-center">Nombre<SortIcon field="name" currentSortField={sortField} sortDirection={sortDirection} /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-primary" onClick={() => handleSort('description')}>
                    <div className="flex items-center">Descripción<SortIcon field="description" currentSortField={sortField} sortDirection={sortDirection} /></div>
                  </TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>{category.description || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleManageSubcategories(category)} className="size-8 p-0" title="Subcategorías"><Settings className="size-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(category)} className="size-8 p-0"><Edit className="size-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="size-8 p-0 text-destructive hover:text-destructive"><Trash2 className="size-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
                              <AlertDialogDescription>Se eliminará permanentemente "{category.name}" y todas sus subcategorías.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(category.id)} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Formulario de categoría */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
            </DialogTitle>
          </DialogHeader>
          <CostCategoryForm
            category={editingCategory}
            onSuccess={handleCloseForm}
            onCancel={handleCloseForm}
          />
        </DialogContent>
      </Dialog>

      {/* Manager de subcategorías */}
      <Dialog open={!!managingSubcategories} onOpenChange={() => setManagingSubcategories(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Subcategorías de "{managingSubcategories?.name}"
            </DialogTitle>
          </DialogHeader>
          {managingSubcategories && (
            <CostSubcategoryManager
              category={managingSubcategories}
              onClose={handleCloseSubcategoriesManager}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
