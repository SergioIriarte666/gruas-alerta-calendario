import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Plus, Power, PowerOff, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useSupplierCategoryManager, SupplierCategory } from '@/hooks/useSupplierCategoryManager';
import { SupplierCategoryForm } from './SupplierCategoryForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

type CategorySortField = 'name' | 'label' | 'description' | 'isActive';
type SortDirection = 'asc' | 'desc';

const SortIcon = ({ field, currentSortField, sortDirection }: { 
  field: CategorySortField; 
  currentSortField?: CategorySortField; 
  sortDirection?: SortDirection 
}) => {
  if (currentSortField !== field) {
    return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />;
  }
  return sortDirection === 'asc' ? 
    <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : 
    <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
};

export const SupplierCategoryList = () => {
  const {
    categories,
    isLoading,
    deleteCategory,
    toggleCategoryStatus,
    isDeleting,
    isToggling
  } = useSupplierCategoryManager();

  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SupplierCategory | null>(null);
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
        case 'label':
          comparison = a.label.localeCompare(b.label);
          break;
        case 'description':
          const descA = a.description || '';
          const descB = b.description || '';
          comparison = descA.localeCompare(descB);
          break;
        case 'isActive':
          comparison = (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [categories, sortField, sortDirection]);

  const handleEdit = (category: SupplierCategory) => {
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

  const handleToggleStatus = (categoryId: string) => {
    toggleCategoryStatus(categoryId);
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Gestión de Categorías de Proveedores</CardTitle>
          <Button 
            onClick={() => setShowForm(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Nueva Categoría
          </Button>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay categorías registradas
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:text-primary transition-colors" 
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Nombre
                      <SortIcon field="name" currentSortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-primary transition-colors" 
                    onClick={() => handleSort('label')}
                  >
                    <div className="flex items-center">
                      Etiqueta
                      <SortIcon field="label" currentSortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-primary transition-colors" 
                    onClick={() => handleSort('description')}
                  >
                    <div className="flex items-center">
                      Descripción
                      <SortIcon field="description" currentSortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-primary transition-colors" 
                    onClick={() => handleSort('isActive')}
                  >
                    <div className="flex items-center">
                      Estado
                      <SortIcon field="isActive" currentSortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">
                      {category.name}
                    </TableCell>
                    <TableCell>{category.label}</TableCell>
                    <TableCell>
                      {category.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={category.is_active ? 'default' : 'secondary'}>
                        {category.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(category.id)}
                          disabled={isToggling}
                          className="h-8 w-8 p-0"
                        >
                          {category.is_active ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(category)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Se eliminará permanentemente la categoría "{category.label}".
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(category.id)}
                                disabled={isDeleting}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Eliminar
                              </AlertDialogAction>
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

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
            </DialogTitle>
          </DialogHeader>
          <SupplierCategoryForm
            category={editingCategory}
            onSuccess={handleCloseForm}
            onCancel={handleCloseForm}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};