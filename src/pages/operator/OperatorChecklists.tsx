import React, { useCallback, useMemo, useState } from 'react';
import { ClipboardCheck, ClipboardList, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useChecklistManager,
  useChecklistTemplates,
  useChecklistsFetcher,
  useOperatorChecklistContext,
} from '@/hooks/useChecklists';
import { ChecklistForm } from '@/components/operator/checklists/ChecklistForm';
import { ChecklistListCard } from '@/components/operator/checklists/ChecklistListCard';
import { ChecklistReadOnlyView } from '@/components/operator/checklists/ChecklistReadOnlyView';
import { businessTimeNow } from '@/utils/checklists/checklistLogic';
import { businessClock } from '@/utils/businessClock';
import { CHECKLIST_TEMPLATE_IDS } from '@/types/checklists';
import { createLogger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import type { ChecklistListItem, ChecklistTemplate } from '@/types/checklists';
import type { ChecklistDraftPatch } from '@/hooks/checklists/useChecklistManager';

const logger = createLogger('Checklists');

const OperatorChecklists = () => {
  const { user } = useUser();
  const isMobile = useIsMobile();

  const { operator, operatorId, cranes, services, suggestedCraneId, isLoading: isLoadingContext } =
    useOperatorChecklistContext(user?.id);
  const { templates, isLoading: isLoadingTemplates } = useChecklistTemplates();
  const { checklists, isLoading: isLoadingList, isFetching, refetch } = useChecklistsFetcher(operatorId);
  const { createDraft, saveDraft, signChecklist, isCreating, isSaving, isSigning } =
    useChecklistManager(operatorId);

  const [activeChecklist, setActiveChecklist] = useState<ChecklistListItem | null>(null);

  const templateById = useMemo(
    () => new Map(templates.map((template) => [template.id, template])),
    [templates],
  );

  const craneLabelById = useMemo(
    () => new Map(cranes.map((crane) => [crane.id, crane.label])),
    [cranes],
  );

  const handleStart = useCallback(async (template: ChecklistTemplate) => {
    if (!operatorId) {
      toast.error('No se encontró el operador asociado a esta cuenta');
      return;
    }

    // El de fatiga no tiene restricción de unicidad: su frecuencia es variable y
    // depende del servicio minero. Si ya hay uno del día, se AVISA y se sigue.
    if (template.id === CHECKLIST_TEMPLATE_IDS.fatiga) {
      const today = businessClock.today();
      const alreadyToday = checklists.some(
        (checklist) =>
          checklist.template_id === CHECKLIST_TEMPLATE_IDS.fatiga &&
          checklist.performed_date === today,
      );
      if (alreadyToday) {
        toast.info('Ya registró un checklist de fatiga hoy', {
          description: 'Puede llenar otro si la faena lo requiere.',
        });
      }
    }

    const suggestedCrane = suggestedCraneId
      ? cranes.find((crane) => crane.id === suggestedCraneId)
      : undefined;

    try {
      const draft = await createDraft.mutateAsync({
        template,
        operatorId,
        craneId: suggestedCrane?.id ?? null,
        serviceId: null,
        header: {
          patente: suggestedCrane?.license_plate ?? '',
          hora: businessTimeNow(),
        },
      });

      setActiveChecklist({
        ...(draft as unknown as ChecklistListItem),
        template_name: template.name,
        template_answer_type: template.answer_type,
        crane_label: suggestedCrane?.label ?? null,
        service_folio: null,
      });
    } catch (error) {
      logger.error('No se pudo iniciar el checklist', error);
    }
  }, [checklists, cranes, createDraft, operatorId, suggestedCraneId]);

  const handleSaveDraft = useCallback(async (patch: ChecklistDraftPatch, silent: boolean) => {
    if (!activeChecklist) return;
    try {
      await saveDraft.mutateAsync({ id: activeChecklist.id, patch, silent });
    } catch (error) {
      // El toast ya lo emite el manager cuando corresponde; acá solo se registra
      // para no dejar una promesa rechazada suelta en el cierre de pantalla.
      logger.warn('Autoguardado de checklist falló', error);
    }
  }, [activeChecklist, saveDraft]);

  const handleSign = useCallback(async (patch: ChecklistDraftPatch) => {
    if (!activeChecklist) return;
    try {
      await signChecklist.mutateAsync({
        id: activeChecklist.id,
        templateId: activeChecklist.template_id,
        patch,
      });
      setActiveChecklist(null);
    } catch (error) {
      // Conflicto de unicidad o cierre previo: el manager ya mostró el mensaje
      // traducido. El borrador queda abierto para que el operador decida.
      logger.debug('Firma no completada', error);
    }
  }, [activeChecklist, signChecklist]);

  // ── Documento abierto ──
  if (activeChecklist) {
    if (activeChecklist.status === 'draft') {
      return (
        <div className={cn('mx-auto w-full', isMobile ? '' : 'max-w-3xl')}>
          <ChecklistForm
            checklist={activeChecklist}
            operator={operator}
            cranes={cranes}
            services={services}
            onSaveDraft={handleSaveDraft}
            onSign={handleSign}
            onExit={() => setActiveChecklist(null)}
            isSaving={isSaving}
            isSigning={isSigning}
          />
        </div>
      );
    }

    return (
      <div className={cn('mx-auto w-full', isMobile ? '' : 'max-w-3xl')}>
        <ChecklistReadOnlyView
          checklist={activeChecklist}
          operator={operator}
          onExit={() => setActiveChecklist(null)}
        />
      </div>
    );
  }

  const isLoading = isLoadingContext || isLoadingTemplates || isLoadingList;
  const preoperacional = templateById.get(CHECKLIST_TEMPLATE_IDS.preoperacional);
  const fatiga = templateById.get(CHECKLIST_TEMPLATE_IDS.fatiga);

  // ── Listado ──
  return (
    <div className={cn('mx-auto w-full space-y-5 pb-4', isMobile ? '' : 'max-w-3xl')}>
      <section className="operator-native-hero overflow-hidden">
        <div className="relative z-10">
          <p className="operator-native-eyebrow">Seguridad</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Checklists</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pre-operacional de la grúa y control de fatiga. No dependen de un servicio.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <div className="px-1">
          <p className="operator-native-eyebrow">Iniciar</p>
          <h2 className="text-xl font-bold text-foreground">Nuevo checklist</h2>
        </div>

        <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
          <Button
            type="button"
            variant="outline"
            disabled={!preoperacional || isCreating || !operatorId}
            onClick={() => preoperacional && handleStart(preoperacional)}
            className="min-h-16 justify-start rounded-2xl px-4 text-left"
          >
            <ShieldCheck className="mr-3 size-5 shrink-0 text-primary" />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-bold">Pre-operacional</span>
              <span className="text-xs font-normal text-muted-foreground">Camión grúa cama</span>
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={!fatiga || isCreating || !operatorId}
            onClick={() => fatiga && handleStart(fatiga)}
            className="min-h-16 justify-start rounded-2xl px-4 text-left"
          >
            <ClipboardList className="mr-3 size-5 shrink-0 text-primary" />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-bold">Fatiga y somnolencia</span>
              <span className="text-xs font-normal text-muted-foreground">Encuesta al conductor</span>
            </span>
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-2 px-1">
          <div>
            <p className="operator-native-eyebrow">Historial</p>
            <h2 className="text-xl font-bold text-foreground">Últimos 30 días</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-xl"
            aria-label="Actualizar listado"
          >
            <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} />
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-3xl" />
            <Skeleton className="h-20 rounded-3xl" />
          </div>
        ) : checklists.length === 0 ? (
          <div className="operator-inspection-card flex flex-col items-center gap-2 rounded-3xl p-8 text-center">
            <ClipboardCheck className="size-8 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Sin checklists en los últimos 30 días</p>
            <p className="text-sm text-muted-foreground">
              Inicie uno cuando lo necesite: son opcionales y no bloquean ningún servicio.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {checklists.map((checklist) => (
              <ChecklistListCard
                key={checklist.id}
                checklist={checklist}
                onOpen={setActiveChecklist}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default OperatorChecklists;
