import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ShieldCheck, Plus, Trash2, Pencil, Check, X, Lock } from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useChecklistMaster } from '@/hooks/checklists/useChecklistMaster';
import {
  ANSWER_TYPE_OPTIONS, INHERIT, SortableChecklistItemRow,
} from './checklists/SortableChecklistItemRow';
import { CHECKLIST_TEMPLATE_IDS } from '@/types/checklists';
import type {
  ChecklistAnswerType, ChecklistRiskAnswer, ChecklistTemplateItem,
} from '@/types/checklists';

const ANSWER_TYPE_LABEL: Record<ChecklistAnswerType, string> = {
  si_no_na: 'Sí / No / N-A',
  bueno_malo_na: 'Bueno / Malo / N-A',
  vigente_no_na: 'Vigente / No vigente / N-A',
};

export const ChecklistMasterTab = () => {
  const {
    templates, isLoading,
    addItem, updateItem, deleteItem, reorderItems,
    addSection, updateSection, deleteSection,
  } = useChecklistMaster();

  const [templateId, setTemplateId] = useState<string>(CHECKLIST_TEMPLATE_IDS.preoperacional);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [addingToSection, setAddingToSection] = useState<string | null>(null);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);

  const template = useMemo(
    () => templates.find((t) => t.id === templateId) ?? templates[0],
    [templates, templateId],
  );

  useEffect(() => {
    if (template && template.id !== templateId) setTemplateId(template.id);
  }, [template, templateId]);

  const isFatiga = template?.id === CHECKLIST_TEMPLATE_IDS.fatiga;

  const totals = useMemo(() => {
    const all = template?.sections.flatMap((s) => s.items) ?? [];
    return { active: all.filter((i) => i.is_active).length, total: all.length };
  }, [template]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // El arrastre opera DENTRO de la sección. Mover ítems entre secciones no está
  // habilitado en esta fase, así que un drop fuera de la lista se ignora.
  const handleDragEnd = (sectionId: string, itemIds: string[]) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = itemIds.indexOf(String(active.id));
    const newIndex = itemIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    reorderItems.mutate({
      sectionId,
      itemIds: arrayMove(itemIds, oldIndex, newIndex),
    });
  };

  const handleAddItem = (sectionId: string) => {
    const label = newItemLabel.trim();
    if (!label) return;
    addItem.mutate({ sectionId, label }, {
      onSuccess: () => { setNewItemLabel(''); setAddingToSection(null); },
    });
  };

  const handleAddSection = () => {
    const title = newSectionTitle.trim();
    if (!title || !template) return;
    addSection.mutate({ templateId: template.id, title }, {
      onSuccess: () => { setNewSectionTitle(''); setShowAddSection(false); },
    });
  };

  if (isLoading || !template) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Cargando maestro de checklists...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-5 text-primary" />
              <div>
                <CardTitle className="text-foreground">Checklists de Seguridad</CardTitle>
                <CardDescription className="mt-1">
                  Ítems del pre-operacional y del control de fatiga
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">{totals.active} activos</Badge>
                <Badge variant="secondary" className="text-xs">{totals.total} total</Badge>
                <Badge variant="outline" className="text-xs">versión {template.version}</Badge>
              </div>
              <Button
                size="sm"
                onClick={() => { setShowAddSection(true); setNewSectionTitle(''); }}
                disabled={showAddSection}
              >
                <Plus className="mr-1 size-4" />
                Agregar sección
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={template.id} onValueChange={setTemplateId}>
              <SelectTrigger className="w-full max-w-md" aria-label="Plantilla">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Las dos plantillas son fijas: de sus ids dependen el índice único
                del pre-operacional y el generador de PDF. */}
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" />
              Plantillas fijas: no se crean ni se eliminan
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Cada cambio sube la versión de la plantilla. Los checklists ya firmados y los
            borradores abiertos conservan su propia copia de los ítems, así que no se ven
            afectados por lo que edite acá.
          </p>

          {showAddSection && (
            <div className="flex gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
              <Input
                autoFocus
                placeholder="Título de la nueva sección..."
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSection();
                  if (e.key === 'Escape') { setShowAddSection(false); setNewSectionTitle(''); }
                }}
                className="bg-background"
              />
              <Button size="sm" onClick={handleAddSection} disabled={!newSectionTitle.trim() || addSection.isPending}>
                {addSection.isPending ? 'Guardando...' : 'Confirmar'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowAddSection(false); setNewSectionTitle(''); }}>
                Cancelar
              </Button>
            </div>
          )}

          <Accordion type="multiple" defaultValue={template.sections.map((s) => s.id)} className="space-y-2">
            {template.sections.map((section) => {
              const itemIds = section.items.map((i) => i.id);
              const activeCount = section.items.filter((i) => i.is_active).length;

              return (
                <AccordionItem key={section.id} value={section.id} className="rounded-lg border border-border px-3">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-1 flex-wrap items-center justify-between gap-2 pr-3">
                      {editingSectionId === section.id ? (
                        <div
                          className="flex flex-1 items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Input
                            autoFocus
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (editingTitle.trim()) {
                                  updateSection.mutate({ id: section.id, title: editingTitle.trim() });
                                }
                                setEditingSectionId(null);
                              }
                              if (e.key === 'Escape') setEditingSectionId(null);
                            }}
                            className="h-7 bg-background text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (editingTitle.trim()) {
                                updateSection.mutate({ id: section.id, title: editingTitle.trim() });
                              }
                              setEditingSectionId(null);
                            }}
                            className="rounded p-1 text-success hover:bg-success-soft"
                          >
                            <Check className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSectionId(null)}
                            className="rounded p-1 text-muted-foreground hover:bg-muted"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-left text-sm font-semibold text-foreground">
                          {section.sort_order}. {section.title}
                        </span>
                      )}

                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {activeCount} activos
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {section.items.length} total
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {section.answer_type
                            ? ANSWER_TYPE_LABEL[section.answer_type]
                            : `Hereda: ${ANSWER_TYPE_LABEL[template.answer_type]}`}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="space-y-3 pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={section.answer_type ?? INHERIT}
                        onValueChange={(value) =>
                          updateSection.mutate({
                            id: section.id,
                            answer_type: value === INHERIT ? null : (value as ChecklistAnswerType),
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-[16rem] text-xs" aria-label={`Tipo de respuesta de ${section.title}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={INHERIT}>
                            Heredar de la plantilla ({ANSWER_TYPE_LABEL[template.answer_type]})
                          </SelectItem>
                          {ANSWER_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setEditingSectionId(section.id); setEditingTitle(section.title); }}
                      >
                        <Pencil className="mr-1 size-3.5" />
                        Renombrar
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setAddingToSection(section.id); setNewItemLabel(''); }}
                        disabled={addingToSection === section.id}
                      >
                        <Plus className="mr-1 size-3.5" />
                        Agregar ítem
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="mr-1 size-3.5" />
                            Eliminar sección
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar sección</AlertDialogTitle>
                            <AlertDialogDescription>
                              {section.items.length > 0 ? (
                                <>
                                  <strong>{section.title}</strong> tiene{' '}
                                  <strong>{section.items.length} ítem(s)</strong>, que se eliminan
                                  junto con ella. Los checklists ya firmados no se ven afectados.
                                </>
                              ) : (
                                <>¿Eliminar <strong>{section.title}</strong>? Está vacía.</>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                deleteSection.mutate({
                                  id: section.id,
                                  confirmItems: section.items.length > 0,
                                })
                              }
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    {addingToSection === section.id && (
                      <div className="flex gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                        <Input
                          autoFocus
                          placeholder="Texto del nuevo ítem..."
                          value={newItemLabel}
                          onChange={(e) => setNewItemLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddItem(section.id);
                            if (e.key === 'Escape') { setAddingToSection(null); setNewItemLabel(''); }
                          }}
                          className="bg-background"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddItem(section.id)}
                          disabled={!newItemLabel.trim() || addItem.isPending}
                        >
                          {addItem.isPending ? 'Guardando...' : 'Confirmar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setAddingToSection(null); setNewItemLabel(''); }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}

                    {section.items.length === 0 ? (
                      <p className="py-3 text-center text-sm text-muted-foreground">
                        Sección sin ítems.
                      </p>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd(section.id, itemIds)}
                      >
                        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                          <div className="space-y-1">
                            {section.items.map((item, index) => (
                              <SortableChecklistItemRow
                                key={item.id}
                                item={item}
                                index={index}
                                showRiskAnswer={isFatiga}
                                editingId={editingItemId}
                                editingLabel={editingLabel}
                                setEditingLabel={setEditingLabel}
                                onEditStart={(target: ChecklistTemplateItem) => {
                                  setEditingItemId(target.id);
                                  setEditingLabel(target.label);
                                }}
                                onEditSave={(id) => {
                                  const trimmed = editingLabel.trim();
                                  if (trimmed) updateItem.mutate({ id, label: trimmed });
                                  setEditingItemId(null);
                                }}
                                onEditCancel={() => setEditingItemId(null)}
                                onToggleActive={(target) =>
                                  updateItem.mutate({ id: target.id, is_active: !target.is_active })
                                }
                                onAnswerTypeChange={(target, value) =>
                                  updateItem.mutate({ id: target.id, answer_type: value })
                                }
                                onRiskAnswerChange={(target, value: ChecklistRiskAnswer) =>
                                  updateItem.mutate({ id: target.id, risk_answer: value })
                                }
                                onDelete={(id) => deleteItem.mutate(id)}
                                isUpdating={updateItem.isPending}
                                isReordering={reorderItems.isPending}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};
