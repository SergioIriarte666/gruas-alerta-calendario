import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, CheckCircle2, PenLine, Save, ShieldAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SignaturePad } from '@/components/operator/SignaturePad';
import { ChecklistAnswerButtons } from './ChecklistAnswerButtons';
import { buildChecklistFormSchema, type ChecklistFormValues } from '@/schemas/checklistSchema';
import { getChecklistReadiness } from '@/utils/checklists/checklistLogic';
import { CHECKLIST_TEMPLATE_IDS } from '@/types/checklists';
import { createLogger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import type { ChecklistAnswer, ChecklistAnswers, ChecklistListItem } from '@/types/checklists';
import type { ChecklistCraneOption, ChecklistOperator, ChecklistServiceOption } from '@/hooks/checklists/useOperatorChecklistContext';
import type { ChecklistDraftPatch } from '@/hooks/checklists/useChecklistManager';

const logger = createLogger('Checklists');

const NO_SERVICE = '__none__';

interface ChecklistFormProps {
  checklist: ChecklistListItem;
  operator: ChecklistOperator | null;
  cranes: ChecklistCraneOption[];
  services: ChecklistServiceOption[];
  onSaveDraft: (patch: ChecklistDraftPatch, silent: boolean) => Promise<void> | void;
  onSign: (patch: ChecklistDraftPatch) => Promise<void>;
  onExit: () => void;
  isSaving: boolean;
  isSigning: boolean;
}

export const ChecklistForm = ({
  checklist,
  operator,
  cranes,
  services,
  onSaveDraft,
  onSign,
  onExit,
  isSaving,
  isSigning,
}: ChecklistFormProps) => {
  // El formulario se arma SIEMPRE desde items_snapshot, nunca desde la plantilla
  // viva: si un admin edita el maestro mientras el operador llena, no se le
  // mueven los ítems bajo el dedo.
  const snapshot = checklist.items_snapshot;
  const answerType = checklist.template_answer_type;
  const isPreoperacional = checklist.template_id === CHECKLIST_TEMPLATE_IDS.preoperacional;

  const schema = useMemo(
    () => buildChecklistFormSchema(snapshot, answerType, checklist.template_id),
    [snapshot, answerType, checklist.template_id],
  );

  const form = useForm<ChecklistFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      answers: checklist.answers as Record<string, string>,
      header: checklist.header ?? {},
      observations: checklist.observations ?? '',
      is_safe_to_operate: checklist.is_safe_to_operate,
      operator_signature: checklist.operator_signature ?? '',
      reviewer_name: checklist.reviewer_name ?? '',
      reviewer_signature: checklist.reviewer_signature ?? '',
      crane_id: checklist.crane_id,
      service_id: checklist.service_id,
    },
  });

  const values = form.watch();
  const answers = (values.answers ?? {}) as ChecklistAnswers;

  const readiness = useMemo(
    () => getChecklistReadiness(snapshot, answers, values.operator_signature),
    [snapshot, answers, values.operator_signature],
  );

  // Pasos: una sección a la vez (32 ítems en 6 secciones no caben juntos en un
  // teléfono) más el paso de cierre.
  const totalSteps = snapshot.length + 1;
  const [step, setStep] = useState(0);
  const isClosingStep = step === snapshot.length;
  const currentSection = isClosingStep ? null : snapshot[step];

  const toPatch = useCallback((formValues: ChecklistFormValues): ChecklistDraftPatch => ({
    answers: formValues.answers as ChecklistAnswers,
    header: formValues.header,
    observations: formValues.observations?.trim() ? formValues.observations : null,
    is_safe_to_operate: formValues.is_safe_to_operate ?? null,
    operator_signature: formValues.operator_signature || null,
    reviewer_name: formValues.reviewer_name?.trim() ? formValues.reviewer_name.trim() : null,
    reviewer_signature: formValues.reviewer_signature || null,
    crane_id: formValues.crane_id ?? null,
    service_id: formValues.service_id ?? null,
  }), []);

  // Espejo de los valores para poder guardar desde un listener del navegador o
  // desde el cleanup del efecto, sin re-suscribir nada en cada tecla.
  const latestRef = useRef(values);
  latestRef.current = values;
  const saveRef = useRef(onSaveDraft);
  saveRef.current = onSaveDraft;

  const saveNow = useCallback((silent: boolean) => {
    void saveRef.current(toPatch(latestRef.current), silent);
  }, [toPatch]);

  // Guardado al SALIR de la pantalla: desmontaje, cambio de app o cierre del
  // WebView. Si iOS mata el proceso, lo que ya está en la base no se pierde.
  useEffect(() => {
    const persist = () => saveNow(true);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persist();
    };
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', onVisibility);
      persist();
    };
  }, [saveNow]);

  const goToStep = (next: number) => {
    if (next < 0 || next >= totalSteps) return;
    // Guardado en CADA cambio de sección.
    saveNow(true);
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAnswer = (itemId: string, answer: ChecklistAnswer) => {
    form.setValue(`answers.${itemId}` as never, answer as never, { shouldDirty: true });
  };

  const handleSign = form.handleSubmit(
    async (formValues) => {
      await onSign(toPatch(formValues));
    },
    (errors) => {
      logger.debug('Firma bloqueada por validación', errors);
      if (readiness.missingAnswers > 0) {
        toast.error(`Faltan ${readiness.missingAnswers} ítem(s) por responder`);
        if (readiness.firstIncompleteSectionIndex >= 0) {
          setStep(readiness.firstIncompleteSectionIndex);
        }
        return;
      }
      if (readiness.missingOperatorSignature) {
        toast.error('Falta la firma del operador');
        setStep(snapshot.length);
        return;
      }
      const firstError = Object.values(errors)[0] as { message?: string } | undefined;
      toast.error(firstError?.message ?? 'Revise los datos antes de firmar');
    },
  );

  const progressPct = readiness.totalCount === 0
    ? 0
    : Math.round((readiness.answeredCount / readiness.totalCount) * 100);

  return (
    <div className="space-y-4 pb-6">
      {/* ── Encabezado fijo: identidad y avance ── */}
      <section className="operator-inspection-card space-y-3 rounded-3xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="operator-native-eyebrow">
              {isPreoperacional ? 'Pre-operacional' : 'Fatiga y somnolencia'}
            </p>
            <h2 className="mt-1 text-lg font-bold leading-tight text-foreground">
              {checklist.template_name}
            </h2>
            {operator && (
              <p className="mt-1 text-sm text-muted-foreground">
                {operator.name} · RUT {operator.rut}
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onExit} className="rounded-xl">
            Salir
          </Button>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="text-muted-foreground">Respondidos</span>
            <span className="text-foreground">
              {readiness.answeredCount} / {readiness.totalCount}
            </span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
      </section>

      {/* ── Paso de sección ── */}
      {currentSection && (
        <section className="operator-inspection-card space-y-4 rounded-3xl p-5">
          <div>
            <p className="operator-native-eyebrow">
              Sección {step + 1} de {snapshot.length}
            </p>
            <h3 className="mt-1 text-base font-bold leading-tight text-foreground">
              {currentSection.title}
            </h3>
          </div>

          <ol className="space-y-4">
            {currentSection.items.map((item, index) => (
              <li key={item.id} className="space-y-2 rounded-2xl border border-border/70 p-3">
                <p className="text-sm font-medium leading-snug text-foreground">
                  <span className="mr-1.5 font-bold text-muted-foreground">{index + 1}.</span>
                  {item.label}
                </p>
                <ChecklistAnswerButtons
                  answerType={answerType}
                  value={answers[item.id]}
                  onChange={(answer) => handleAnswer(item.id, answer)}
                  itemLabel={item.label}
                />
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── Paso de cierre ── */}
      {isClosingStep && (
        <>
          <section className="operator-inspection-card space-y-4 rounded-3xl p-5">
            <div>
              <p className="operator-native-eyebrow">Antecedentes</p>
              <h3 className="mt-1 text-base font-bold text-foreground">Datos del documento</h3>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="checklist-crane">Grúa</Label>
                <Select
                  value={values.crane_id ?? NO_SERVICE}
                  onValueChange={(value) =>
                    form.setValue('crane_id', value === NO_SERVICE ? null : value, { shouldDirty: true })
                  }
                >
                  <SelectTrigger id="checklist-crane" className="min-h-12 rounded-xl">
                    <SelectValue placeholder="Seleccione la grúa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SERVICE}>Sin grúa</SelectItem>
                    {cranes.map((crane) => (
                      <SelectItem key={crane.id} value={crane.id}>{crane.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="checklist-service">Folio (opcional)</Label>
                <Select
                  value={values.service_id ?? NO_SERVICE}
                  onValueChange={(value) =>
                    form.setValue('service_id', value === NO_SERVICE ? null : value, { shouldDirty: true })
                  }
                >
                  <SelectTrigger id="checklist-service" className="min-h-12 rounded-xl">
                    <SelectValue placeholder="Sin folio asociado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SERVICE}>Sin folio asociado</SelectItem>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>{service.folio}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="checklist-faena">Faena</Label>
                <Input id="checklist-faena" className="min-h-12 rounded-xl" {...form.register('header.faena')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="checklist-area">Área / Empresa</Label>
                <Input id="checklist-area" className="min-h-12 rounded-xl" {...form.register('header.area_empresa')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="checklist-tipo">Tipo de vehículo</Label>
                <Input id="checklist-tipo" className="min-h-12 rounded-xl" {...form.register('header.tipo_vehiculo')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="checklist-patente">Patente</Label>
                <Input id="checklist-patente" className="min-h-12 rounded-xl" {...form.register('header.patente')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="checklist-km">Kilometraje / Horas</Label>
                <Input id="checklist-km" inputMode="numeric" className="min-h-12 rounded-xl" {...form.register('header.kilometraje_horas')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="checklist-lugar">Lugar de operación</Label>
                <Input id="checklist-lugar" className="min-h-12 rounded-xl" {...form.register('header.lugar_operacion')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="checklist-hora">Hora</Label>
                <Input id="checklist-hora" className="min-h-12 rounded-xl" {...form.register('header.hora')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="checklist-observations">Observaciones generales</Label>
              <Textarea
                id="checklist-observations"
                rows={4}
                className="rounded-xl"
                placeholder="Anote cualquier hallazgo relevante"
                {...form.register('observations')}
              />
            </div>
          </section>

          {isPreoperacional && (
            <section className="operator-inspection-card space-y-3 rounded-3xl p-5">
              <div>
                <p className="operator-native-eyebrow">Cierre</p>
                <h3 className="mt-1 text-base font-bold leading-snug text-foreground">
                  ¿El camión se encuentra en condiciones seguras para operar?
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={values.is_safe_to_operate === true}
                  onClick={() => form.setValue('is_safe_to_operate', true, { shouldDirty: true })}
                  className={cn(
                    'flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 text-base font-bold',
                    values.is_safe_to_operate === true
                      ? 'border-success bg-success text-success-foreground'
                      : 'border-border bg-background text-muted-foreground',
                  )}
                >
                  <ShieldCheck className="size-5" /> Sí
                </button>
                <button
                  type="button"
                  aria-pressed={values.is_safe_to_operate === false}
                  onClick={() => form.setValue('is_safe_to_operate', false, { shouldDirty: true })}
                  className={cn(
                    'flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 text-base font-bold',
                    values.is_safe_to_operate === false
                      ? 'border-danger bg-danger text-danger-foreground'
                      : 'border-border bg-background text-muted-foreground',
                  )}
                >
                  <ShieldAlert className="size-5" /> No
                </button>
              </div>
            </section>
          )}

          <section className="operator-inspection-card space-y-4 rounded-3xl p-5">
            <div>
              <p className="operator-native-eyebrow">Firmas</p>
              <h3 className="mt-1 text-base font-bold text-foreground">Responsables</h3>
            </div>

            <SignaturePad
              label="Firma del operador"
              personName={operator?.name}
              signature={values.operator_signature}
              onSignatureChange={(signature) =>
                form.setValue('operator_signature', signature, { shouldDirty: true, shouldValidate: true })
              }
            />

            <div className="space-y-1.5">
              <Label htmlFor="checklist-reviewer">Nombre del revisor / supervisor (opcional)</Label>
              <Input
                id="checklist-reviewer"
                className="min-h-12 rounded-xl"
                placeholder="Quien revisa el checklist"
                {...form.register('reviewer_name')}
              />
              {form.formState.errors.reviewer_name && (
                <p className="text-sm font-medium text-danger-text">
                  {form.formState.errors.reviewer_name.message as string}
                </p>
              )}
            </div>

            <SignaturePad
              label="Firma del revisor / supervisor (opcional)"
              personName={values.reviewer_name || undefined}
              signature={values.reviewer_signature}
              onSignatureChange={(signature) =>
                form.setValue('reviewer_signature', signature, { shouldDirty: true })
              }
            />
          </section>
        </>
      )}

      {/* ── Navegación ── */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-12 flex-1 rounded-2xl"
            disabled={step === 0}
            onClick={() => goToStep(step - 1)}
          >
            <ArrowLeft className="mr-2 size-4" />
            Anterior
          </Button>
          {!isClosingStep ? (
            <Button
              type="button"
              className="min-h-12 flex-1 rounded-2xl font-bold"
              onClick={() => goToStep(step + 1)}
            >
              Siguiente
              <ArrowRight className="ml-2 size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              className="min-h-12 flex-1 rounded-2xl font-bold"
              disabled={isSigning}
              onClick={handleSign}
            >
              <PenLine className="mr-2 size-4" />
              {isSigning ? 'Firmando…' : 'Firmar y cerrar'}
            </Button>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          className="min-h-11 rounded-2xl"
          disabled={isSaving}
          onClick={() => saveNow(false)}
        >
          <Save className="mr-2 size-4" />
          {isSaving ? 'Guardando…' : 'Guardar avance'}
        </Button>

        {readiness.ready && !isClosingStep && (
          <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-success-text">
            <CheckCircle2 className="size-4" />
            Todo respondido: ya puede firmar en el último paso
          </p>
        )}
      </div>
    </div>
  );
};
