import React from 'react';
import { ArrowLeft, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChecklistAnswerButtons } from './ChecklistAnswerButtons';
import { CHECKLIST_TEMPLATE_IDS } from '@/types/checklists';
import { businessClock } from '@/utils/businessClock';
import { answerTypeForSnapshotItem } from '@/utils/checklists/checklistLogic';
import type { ChecklistListItem } from '@/types/checklists';
import type { ChecklistOperator } from '@/hooks/checklists/useOperatorChecklistContext';

interface ChecklistReadOnlyViewProps {
  checklist: ChecklistListItem;
  operator: ChecklistOperator | null;
  onExit: () => void;
}

const HEADER_FIELDS: Array<[keyof ChecklistListItem['header'], string]> = [
  ['faena', 'Faena'],
  ['area_empresa', 'Área / Empresa'],
  ['tipo_vehiculo', 'Tipo de vehículo'],
  ['patente', 'Patente'],
  ['kilometraje_horas', 'Kilometraje / Horas'],
  ['lugar_operacion', 'Lugar de operación'],
  ['hora', 'Hora'],
];

/** Un checklist firmado no se edita: se lee tal cual quedó. */
export const ChecklistReadOnlyView = ({ checklist, operator, onExit }: ChecklistReadOnlyViewProps) => {
  const isPreoperacional = checklist.template_id === CHECKLIST_TEMPLATE_IDS.preoperacional;
  const headerEntries = HEADER_FIELDS.filter(([key]) => Boolean(checklist.header?.[key]));

  return (
    <div className="space-y-4 pb-6">
      <section className="operator-inspection-card space-y-3 rounded-3xl p-5">
        <Button type="button" variant="ghost" size="sm" onClick={onExit} className="-ml-2 rounded-xl">
          <ArrowLeft className="mr-2 size-4" />
          Volver al listado
        </Button>

        <div>
          <p className="operator-native-eyebrow">
            {isPreoperacional ? 'Pre-operacional' : 'Fatiga y somnolencia'}
          </p>
          <h2 className="mt-1 text-lg font-bold leading-tight text-foreground">
            {checklist.template_name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {businessClock.format(checklist.performed_at, "dd/MM/yyyy HH:mm")}
            {operator ? ` · ${operator.name}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-success/30 bg-success/10 text-success-text">
            Firmado
          </Badge>
          {checklist.crane_label && <Badge variant="outline">{checklist.crane_label}</Badge>}
          {checklist.service_folio && <Badge variant="outline">Folio {checklist.service_folio}</Badge>}
        </div>

        {headerEntries.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
            {headerEntries.map(([key, label]) => (
              <div key={String(key)}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
                <dd className="text-sm font-medium text-foreground">{checklist.header[key]}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {checklist.items_snapshot.map((section) => (
        <section key={section.id} className="operator-inspection-card space-y-4 rounded-3xl p-5">
          <h3 className="text-base font-bold leading-tight text-foreground">{section.title}</h3>
          <ol className="space-y-4">
            {section.items.map((item, index) => (
              <li key={item.id} className="space-y-2 rounded-2xl border border-border/70 p-3">
                <p className="text-sm font-medium leading-snug text-foreground">
                  <span className="mr-1.5 font-bold text-muted-foreground">{index + 1}.</span>
                  {item.label}
                </p>
                {/* Se renderiza con el answer_type congelado en el snapshot:
                    un documento firmado con la v1 de la plantilla conserva sus
                    opciones aunque el maestro ya vaya en la v2. */}
                <ChecklistAnswerButtons
                  answerType={answerTypeForSnapshotItem(item, section, checklist.template_answer_type)}
                  value={checklist.answers[item.id]}
                  itemLabel={item.label}
                  disabled
                />
              </li>
            ))}
          </ol>
        </section>
      ))}

      {checklist.observations && (
        <section className="operator-inspection-card space-y-2 rounded-3xl p-5">
          <h3 className="text-base font-bold text-foreground">Observaciones</h3>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{checklist.observations}</p>
        </section>
      )}

      {isPreoperacional && checklist.is_safe_to_operate !== null && (
        <section className="operator-inspection-card space-y-2 rounded-3xl p-5">
          <h3 className="text-base font-bold leading-snug text-foreground">
            ¿El camión se encuentra en condiciones seguras para operar?
          </h3>
          <p
            className={`flex items-center gap-2 text-base font-bold ${
              checklist.is_safe_to_operate ? 'text-success-text' : 'text-danger-text'
            }`}
          >
            {checklist.is_safe_to_operate ? <ShieldCheck className="size-5" /> : <ShieldAlert className="size-5" />}
            {checklist.is_safe_to_operate ? 'Sí' : 'No'}
          </p>
        </section>
      )}

      <section className="operator-inspection-card space-y-4 rounded-3xl p-5">
        <h3 className="text-base font-bold text-foreground">Firmas</h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operador</p>
            {checklist.operator_signature ? (
              <img
                src={checklist.operator_signature}
                alt="Firma del operador"
                className="h-28 w-full rounded-2xl border border-border bg-signature-surface object-contain"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Sin firma registrada</p>
            )}
          </div>

          {checklist.reviewer_signature && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Revisor {checklist.reviewer_name ? `· ${checklist.reviewer_name}` : ''}
              </p>
              <img
                src={checklist.reviewer_signature}
                alt="Firma del revisor"
                className="h-28 w-full rounded-2xl border border-border bg-signature-surface object-contain"
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
