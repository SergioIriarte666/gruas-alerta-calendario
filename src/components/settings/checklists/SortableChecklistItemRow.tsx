import { type CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2, Pencil, Check, X, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ChecklistAnswerType, ChecklistRiskAnswer, ChecklistTemplateItem } from '@/types/checklists';

/** Valor centinela: los Select de Radix no admiten "" como value. */
export const INHERIT = '__inherit__';
export const NO_RISK = '__none__';

export const ANSWER_TYPE_OPTIONS: Array<{ value: ChecklistAnswerType; label: string }> = [
  { value: 'si_no_na', label: 'Sí / No / N-A' },
  { value: 'bueno_malo_na', label: 'Bueno / Malo / N-A' },
  { value: 'vigente_no_na', label: 'Vigente / No vigente / N-A' },
];

interface SortableChecklistItemRowProps {
  item: ChecklistTemplateItem;
  index: number;
  /** El de fatiga es el único donde risk_answer significa algo. */
  showRiskAnswer: boolean;
  editingId: string | null;
  editingLabel: string;
  setEditingLabel: (value: string) => void;
  onEditStart: (item: ChecklistTemplateItem) => void;
  onEditSave: (id: string) => void;
  onEditCancel: () => void;
  onToggleActive: (item: ChecklistTemplateItem) => void;
  onAnswerTypeChange: (item: ChecklistTemplateItem, value: ChecklistAnswerType | null) => void;
  onRiskAnswerChange: (item: ChecklistTemplateItem, value: ChecklistRiskAnswer) => void;
  onDelete: (id: string) => void;
  isUpdating: boolean;
  isReordering: boolean;
}

export const SortableChecklistItemRow = ({
  item, index, showRiskAnswer, editingId, editingLabel, setEditingLabel,
  onEditStart, onEditSave, onEditCancel, onToggleActive,
  onAnswerTypeChange, onRiskAnswerChange, onDelete, isUpdating, isReordering,
}: SortableChecklistItemRowProps) => {
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
      className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
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
        aria-label={`Arrastrar ${item.label} para reordenar`}
      >
        <GripVertical className="size-4" />
      </button>

      <div className="min-w-[12rem] flex-1">
        {editingId === item.id ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={editingLabel}
              onChange={(e) => setEditingLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onEditSave(item.id);
                if (e.key === 'Escape') onEditCancel();
              }}
              className="h-7 bg-background text-sm"
            />
            <button
              type="button"
              onClick={() => onEditSave(item.id)}
              className="rounded p-1 text-success hover:bg-success-soft"
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
          <span className="text-sm font-medium text-foreground">{item.label}</span>
        )}
      </div>

      <span className="w-6 text-center font-mono text-xs text-muted-foreground">{index + 1}</span>

      {/* NULL = hereda de la sección. Es el estado por defecto de los 38 ítems. */}
      <Select
        value={item.answer_type ?? INHERIT}
        onValueChange={(value) =>
          onAnswerTypeChange(item, value === INHERIT ? null : (value as ChecklistAnswerType))
        }
      >
        <SelectTrigger className="h-7 w-[13rem] text-xs" aria-label={`Tipo de respuesta de ${item.label}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={INHERIT}>Heredar de la sección</SelectItem>
          {ANSWER_TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showRiskAnswer && (
        <Select
          value={item.risk_answer ?? NO_RISK}
          onValueChange={(value) =>
            onRiskAnswerChange(item, value === NO_RISK ? null : (value as 'si' | 'no'))
          }
        >
          <SelectTrigger className="h-7 w-[10rem] text-xs" aria-label={`Respuesta de riesgo de ${item.label}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_RISK}>Sin riesgo marcado</SelectItem>
            <SelectItem value="si">Riesgo si responde Sí</SelectItem>
            <SelectItem value="no">Riesgo si responde No</SelectItem>
          </SelectContent>
        </Select>
      )}

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
          disabled={isUpdating}
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
            <AlertDialogTitle>Eliminar ítem</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar <strong>{item.label}</strong> de la plantilla? Esta acción no se puede
              deshacer. Los checklists ya firmados y los borradores abiertos NO se ven afectados:
              cada uno guarda su propia copia de los ítems.
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
