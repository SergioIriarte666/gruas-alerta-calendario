import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Power, PowerOff, GripVertical, SlidersHorizontal } from 'lucide-react';
import { useCostSubcategories } from '@/hooks/useCostSubcategories';
import { CostCategory } from '@/types/costs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CostSubcategoryManagerProps {
  category: CostCategory;
  onClose: () => void;
}

export const CostSubcategoryManager = ({ category, onClose }: CostSubcategoryManagerProps) => {
  const {
    allSubcategories,
    isLoadingAll,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
    toggleSubcategoryStatus,
    isCreating,
    isUpdating,
    isDeleting,
    isToggling,
  } = useCostSubcategories(category.id);

  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [editingSubcategory, setEditingSubcategory] = useState<any | null>(null);
  const [otherReasonsText, setOtherReasonsText] = useState('');
  const [rules, setRules] = useState({
    requires_crane: false,
    requires_operator: false,
    requires_supplier: false,
    requires_document: false,
    requires_location: false,
    requires_other_reason: false,
    routes_to_inventory: false,
  });

  const handleAdd = () => {
    if (!newSubcategoryName.trim()) return;

    const maxOrder = allSubcategories.reduce((max, sub) => Math.max(max, sub.display_order), 0);
    
    createSubcategory({
      category_id: category.id,
      name: newSubcategoryName.trim(),
      display_order: maxOrder + 1,
    });
    
    setNewSubcategoryName('');
  };

  const handleDelete = (subcategoryId: string) => {
    deleteSubcategory({ id: subcategoryId, category_id: category.id });
  };

  const handleToggleStatus = (subcategoryId: string) => {
    toggleSubcategoryStatus({ id: subcategoryId, category_id: category.id });
  };

  const openRulesEditor = (subcategory: any) => {
    setEditingSubcategory(subcategory);

    const currentOtherReasons = Array.isArray(subcategory.other_reasons)
      ? (subcategory.other_reasons as any[]).map(v => String(v)).filter(Boolean)
      : [];

    setOtherReasonsText(currentOtherReasons.join('\n'));

    setRules({
      requires_crane: !!subcategory.requires_crane,
      requires_operator: !!subcategory.requires_operator,
      requires_supplier: !!subcategory.requires_supplier,
      requires_document: !!subcategory.requires_document,
      requires_location: !!subcategory.requires_location,
      requires_other_reason: !!subcategory.requires_other_reason,
      routes_to_inventory: !!subcategory.routes_to_inventory,
    });
  };

  const saveRules = () => {
    if (!editingSubcategory) return;

    const otherReasons = otherReasonsText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    updateSubcategory({
      id: editingSubcategory.id,
      category_id: category.id,
      name: editingSubcategory.name,
      requires_crane: rules.requires_crane,
      requires_operator: rules.requires_operator,
      requires_supplier: rules.requires_supplier,
      requires_document: rules.requires_document,
      requires_location: rules.requires_location,
      requires_other_reason: rules.requires_other_reason,
      routes_to_inventory: rules.routes_to_inventory,
      other_reasons: otherReasons.length > 0 ? otherReasons : null,
    });

    setEditingSubcategory(null);
  };

  if (isLoadingAll) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Cargando subcategorías...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Agregar nueva subcategoría */}
      <div className="flex gap-2">
        <Input
          placeholder="Nombre de la subcategoría..."
          value={newSubcategoryName}
          onChange={(e) => setNewSubcategoryName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          disabled={isCreating}
        />
        <Button
          onClick={handleAdd}
          disabled={isCreating || !newSubcategoryName.trim()}
          className="gap-2 flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </div>

      {/* Lista de subcategorías */}
      {allSubcategories.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
          No hay subcategorías para esta categoría.
          <br />
          Agrega la primera usando el campo de arriba.
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allSubcategories.map((subcategory) => (
                <TableRow key={subcategory.id}>
                  <TableCell>
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                  <TableCell className="font-medium">
                    {subcategory.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant={subcategory.is_active ? 'default' : 'secondary'}>
                      {subcategory.is_active ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openRulesEditor(subcategory)}
                        className="h-8 w-8 p-0"
                        title="Reglas"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(subcategory.id)}
                        disabled={isToggling}
                        className="h-8 w-8 p-0"
                        title={subcategory.is_active ? 'Desactivar' : 'Activar'}
                      >
                        {subcategory.is_active ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
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
                            <AlertDialogTitle>¿Eliminar subcategoría?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminará permanentemente la subcategoría "{subcategory.name}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(subcategory.id)}
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
        </div>
      )}

      <Dialog open={!!editingSubcategory} onOpenChange={(open) => !open && setEditingSubcategory(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Reglas de "{editingSubcategory?.name}"</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 h-10 px-3 border rounded-md">
              <Checkbox checked={rules.requires_crane} onCheckedChange={(v) => setRules(prev => ({ ...prev, requires_crane: !!v }))} />
              <span className="text-sm">Requiere grúa</span>
            </div>
            <div className="flex items-center gap-2 h-10 px-3 border rounded-md">
              <Checkbox checked={rules.requires_operator} onCheckedChange={(v) => setRules(prev => ({ ...prev, requires_operator: !!v }))} />
              <span className="text-sm">Requiere operador</span>
            </div>
            <div className="flex items-center gap-2 h-10 px-3 border rounded-md">
              <Checkbox checked={rules.requires_supplier} onCheckedChange={(v) => setRules(prev => ({ ...prev, requires_supplier: !!v }))} />
              <span className="text-sm">Requiere proveedor</span>
            </div>
            <div className="flex items-center gap-2 h-10 px-3 border rounded-md">
              <Checkbox checked={rules.requires_document} onCheckedChange={(v) => setRules(prev => ({ ...prev, requires_document: !!v }))} />
              <span className="text-sm">Requiere documento</span>
            </div>
            <div className="flex items-center gap-2 h-10 px-3 border rounded-md">
              <Checkbox checked={rules.requires_location} onCheckedChange={(v) => setRules(prev => ({ ...prev, requires_location: !!v }))} />
              <span className="text-sm">Requiere ubicación</span>
            </div>
            <div className="flex items-center gap-2 h-10 px-3 border rounded-md">
              <Checkbox checked={rules.routes_to_inventory} onCheckedChange={(v) => setRules(prev => ({ ...prev, routes_to_inventory: !!v }))} />
              <span className="text-sm">Rutea a bodega</span>
            </div>
            <div className="flex items-center gap-2 h-10 px-3 border rounded-md md:col-span-2">
              <Checkbox checked={rules.requires_other_reason} onCheckedChange={(v) => setRules(prev => ({ ...prev, requires_other_reason: !!v }))} />
              <span className="text-sm">Requiere motivo (Otros)</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Motivos (uno por línea)</div>
            <Textarea
              value={otherReasonsText}
              onChange={(e) => setOtherReasonsText(e.target.value)}
              rows={6}
              placeholder="Ej: Error de proveedor / documento pendiente"
              disabled={!rules.requires_other_reason}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSubcategory(null)}>Cancelar</Button>
            <Button onClick={saveRules} disabled={isUpdating}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex justify-end pt-4 border-t">
        <Button onClick={onClose} variant="outline">
          Cerrar
        </Button>
      </div>
    </div>
  );
};
