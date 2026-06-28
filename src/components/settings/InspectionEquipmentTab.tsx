import { useState, type CSSProperties } from 'react';
import { useInspectionEquipment, EquipmentItem } from '@/hooks/useInspectionEquipment';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ClipboardList, Plus, Trash2, AlertTriangle, Pencil, Check, X, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableEquipmentRowProps {
  item: EquipmentItem;
  index: number;
  isOnlyActive: boolean;
  editingId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  onEditStart: (item: EquipmentItem) => void;
  onEditSave: (id: string) => void;
  onEditCancel: () => void;
  onToggleActive: (item: EquipmentItem) => void;
  onDelete: (id: string) => void;
  isUpdating: boolean;
  isReordering: boolean;
}

const SortableEquipmentRow = ({
  item,
  index,
  isOnlyActive,
  editingId,
  editingName,
  setEditingName,
  onEditStart,
  onEditSave,
  onEditCancel,
  onToggleActive,
  onDelete,
  isUpdating,
  isReordering,
}: SortableEquipmentRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
        item.is_active
          ? 'border-border bg-card hover:bg-muted/50'
          : 'border-border/50 bg-muted/30 opacity-60'
      } ${isDragging ? 'border-primary shadow-lg' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={isReordering}
        className="touch-none cursor-grab rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
        aria-label={`Arrastrar ${item.name} para reordenar`}
      >
        <GripVertical className="size-4" />
      </button>

      <div className="min-w-0 flex-1">
        {editingId === item.id ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onEditSave(item.id);
                if (e.key === 'Escape') onEditCancel();
              }}
              className="h-7 bg-background text-sm"
            />
            <button
              type="button"
              onClick={() => onEditSave(item.id)}
              className="rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
            >
              <Check className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onEditCancel}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <span className="text-sm font-medium text-foreground">{item.name}</span>
        )}
      </div>

      <span className="w-6 text-center font-mono text-xs text-muted-foreground">{index + 1}</span>

      {editingId !== item.id && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={() => onEditStart(item)}
        >
          <Pencil className="size-3.5" />
        </Button>
      )}

      <div className="flex items-center gap-1.5">
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {item.is_active ? 'Activo' : 'Inactivo'}
        </span>
        <Switch
          checked={item.is_active}
          onCheckedChange={() => onToggleActive(item)}
          disabled={isUpdating || isOnlyActive}
        />
      </div>

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
              onClick={() => onDelete(item.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {items.map((item, index) => (
                    <SortableEquipmentRow
                      key={item.id}
                      item={item}
                      index={index}
                      isOnlyActive={activeItems.length === 1 && item.is_active}
                      editingId={editingId}
                      editingName={editingName}
                      setEditingName={setEditingName}
                      onEditStart={handleEditStart}
                      onEditSave={handleEditSave}
                      onEditCancel={() => setEditingId(null)}
                      onToggleActive={handleToggleActive}
                      onDelete={(id) => deleteItem.mutate(id)}
                      isUpdating={updateItem.isPending}
                      isReordering={reorderItems.isPending}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
