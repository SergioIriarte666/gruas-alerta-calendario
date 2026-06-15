import { useState } from 'react';
import { useInspectionEquipment, EquipmentItem } from '@/hooks/useInspectionEquipment';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ClipboardList, Plus, Trash2, ChevronUp, ChevronDown, AlertTriangle, Pencil, Check, X } from 'lucide-react';

export const InspectionEquipmentTab = () => {
  const { items, activeItems, isLoading, addItem, updateItem, deleteItem, reorderItems } = useInspectionEquipment();
  const [newName, setNewName] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    addItem.mutate(trimmed, {
      onSuccess: () => {
        setNewName('');
        setShowAddInput(false);
      },
    });
  };

  const handleEditStart = (item: EquipmentItem) => {
    setEditingId(item.id);
    setEditingName(item.name);
  };

  const handleEditSave = (id: string) => {
    const trimmed = editingName.trim();
    if (trimmed) {
      updateItem.mutate({ id, name: trimmed });
    }
    setEditingId(null);
  };

  const handleToggleActive = (item: EquipmentItem) => {
    updateItem.mutate({ id: item.id, is_active: !item.is_active });
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const reordered = [...items];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    reorderItems.mutate(reordered);
  };

  const handleMoveDown = (index: number) => {
    if (index === items.length - 1) return;
    const reordered = [...items];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    reorderItems.mutate(reordered);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardList className="size-5 text-primary" />
              <div>
                <CardTitle className="text-foreground">Inventario de Inspección</CardTitle>
                <CardDescription className="mt-1">
                  Elementos del checklist de inventario del vehículo
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">
                  {activeItems.length} activos
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {items.length} total
                </Badge>
              </div>
              <Button
                size="sm"
                onClick={() => { setShowAddInput(true); setNewName(''); }}
                disabled={showAddInput}
              >
                <Plus className="size-4 mr-1" />
                Agregar elemento
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeItems.length < 5 && activeItems.length > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="size-4 flex-shrink-0" />
              Quedan menos de 5 elementos activos en el inventario.
            </div>
          )}

          {showAddInput && (
            <div className="flex gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
              <Input
                autoFocus
                placeholder="Nombre del nuevo elemento..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                  if (e.key === 'Escape') { setShowAddInput(false); setNewName(''); }
                }}
                className="bg-background"
              />
              <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || addItem.isPending}>
                {addItem.isPending ? 'Guardando...' : 'Confirmar'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowAddInput(false); setNewName(''); }}>
                Cancelar
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Cargando inventario...</div>
          ) : (
            <div className="space-y-1">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                    item.is_active
                      ? 'border-border bg-card hover:bg-muted/50'
                      : 'border-border/50 bg-muted/30 opacity-60'
                  }`}
                >
                  {/* Botones de reordenamiento */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0 || reorderItems.isPending}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronUp className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === items.length - 1 || reorderItems.isPending}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronDown className="size-3" />
                    </button>
                  </div>

                  {/* Nombre con edición inline */}
                  <div className="flex-1 min-w-0">
                    {editingId === item.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEditSave(item.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="h-7 bg-background text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleEditSave(item.id)}
                          className="rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                        >
                          <Check className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded p-1 text-muted-foreground hover:bg-muted"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-foreground">{item.name}</span>
                    )}
                  </div>

                  {/* Número de orden */}
                  <span className="text-xs text-muted-foreground w-6 text-center">{index + 1}</span>

                  {/* Botón editar */}
                  {editingId !== item.id && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      onClick={() => handleEditStart(item)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  )}

                  {/* Toggle activo/inactivo */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {item.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                    <Switch
                      checked={item.is_active}
                      onCheckedChange={() => handleToggleActive(item)}
                      disabled={updateItem.isPending}
                    />
                  </div>

                  {/* Eliminar */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar elemento</AlertDialogTitle>
                        <AlertDialogDescription>
                          ¿Eliminar <strong>{item.name}</strong> del inventario? Esta acción no se puede deshacer.
                          Las inspecciones ya completadas no se ven afectadas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteItem.mutate(item.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
