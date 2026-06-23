import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Edit, Plus, Power, PowerOff } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSupplierCategoryManager } from '@/hooks/useSupplierCategoryManager';
import type { SupplierCategory } from '@/types/suppliers';
import { SupplierCategoryForm } from './SupplierCategoryForm';

export const SupplierCategoryList = () => {
  const isMobile = useIsMobile();
  const { categories, isLoading, toggleCategoryStatus, isToggling } = useSupplierCategoryManager();

  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SupplierCategory | null>(null);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => (a.label || a.name).localeCompare(b.label || b.name));
  }, [categories]);

  const handleEdit = (category: SupplierCategory) => {
    setEditingCategory(category);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingCategory(null);
  };

  const handleToggle = (category: SupplierCategory) => {
    toggleCategoryStatus({ id: category.id, is_active: !category.is_active });
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
          <CardTitle className="text-lg sm:text-xl">Categorías de Proveedores</CardTitle>
          <Button
            onClick={() => setShowForm(true)}
            className="gap-2"
            size={isMobile ? 'sm' : 'default'}
          >
            <Plus className="size-4" />
            {isMobile ? 'Nueva' : 'Nueva Categoría'}
          </Button>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          {sortedCategories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No hay categorías registradas</div>
          ) : isMobile ? (
            <div className="space-y-3">
              {sortedCategories.map((category) => (
                <Card key={category.id} className="border bg-card">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground text-sm truncate">{category.label || category.name}</p>
                          <Badge variant="secondary" className={category.is_active ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border/70'}>
                            {category.is_active ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate">{category.name}</p>
                        {category.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{category.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => handleToggle(category)}
                          disabled={isToggling}
                        >
                          {category.is_active ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => handleEdit(category)}>
                          <Edit className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre visible</TableHead>
                  <TableHead>Identificador</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.label || category.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{category.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={category.is_active ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border/70'}>
                        {category.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[420px] truncate">{category.description || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-8 p-0"
                          onClick={() => handleToggle(category)}
                          disabled={isToggling}
                        >
                          {category.is_active ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="size-8 p-0" onClick={() => handleEdit(category)}>
                          <Edit className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={(open) => !open && handleCloseForm()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
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
