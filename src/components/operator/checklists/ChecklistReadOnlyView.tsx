import React, { useState } from 'react';
import { ArrowLeft, Download, FileText, Mail, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChecklistAnswerButtons } from './ChecklistAnswerButtons';
import { CHECKLIST_TEMPLATE_IDS } from '@/types/checklists';
import { businessClock } from '@/utils/businessClock';
import { answerTypeForSnapshotItem } from '@/utils/checklists/checklistLogic';
import {
  CHECKLIST_PDF_BUCKET,
  getChecklistPdfSignedUrl,
} from '@/utils/checklists/checklistPdfUpload';
import { extractStoragePath } from '@/utils/storagePath';
import { createLogger } from '@/lib/logger';
import { useChecklistEmailStatus } from '@/hooks/useChecklists';

const logger = createLogger('ChecklistPDF');
import type { ChecklistListItem } from '@/types/checklists';
import type { ChecklistOperator } from '@/hooks/checklists/useOperatorChecklistContext';

interface ChecklistReadOnlyViewProps {
  checklist: ChecklistListItem;
  operator: ChecklistOperator | null;
  onExit: () => void;
  onRegeneratePdf: () => void;
  isGeneratingPdf: boolean;
  onResendEmail: () => void;
  isSendingEmail: boolean;
}

/**
 * Badge del envío interno. Los estados salen tal cual del outbox: 'skipped' no
 * es un fallo —el worker lo usa cuando falta el PDF o no hay destinatario— así
 * que se muestra como pendiente de resolver y no como error.
 */
const EMAIL_BADGE: Record<string, { label: string; className: string }> = {
  pending:    { label: 'Correo pendiente',  className: 'border-warning/30 bg-warning/10 text-warning-text' },
  processing: { label: 'Enviando correo',   className: 'border-warning/30 bg-warning/10 text-warning-text' },
  sent:       { label: 'Correo enviado',    className: 'border-success/30 bg-success/10 text-success-text' },
  failed:     { label: 'Correo falló',      className: 'border-danger/30 bg-danger/10 text-danger-text' },
  skipped:    { label: 'Correo no enviado', className: 'border-warning/30 bg-warning/10 text-warning-text' },
};

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
export const ChecklistReadOnlyView = ({
  checklist,
  operator,
  onExit,
  onRegeneratePdf,
  isGeneratingPdf,
  onResendEmail,
  isSendingEmail,
}: ChecklistReadOnlyViewProps) => {
  const { emailState } = useChecklistEmailStatus(checklist.id);
  const emailBadge = emailState ? EMAIL_BADGE[emailState.status] : null;
  const isPreoperacional = checklist.template_id === CHECKLIST_TEMPLATE_IDS.preoperacional;
  const headerEntries = HEADER_FIELDS.filter(([key]) => Boolean(checklist.header?.[key]));
  const [isOpeningPdf, setIsOpeningPdf] = useState(false);

  // El bucket es privado y lo persistido es el PATH: la URL firmada se pide al
  // momento de abrir, porque una guardada caduca a los 7 días.
  const handleDownloadPdf = async () => {
    if (!checklist.pdf_url) return;
    setIsOpeningPdf(true);
    try {
      const path = extractStoragePath(checklist.pdf_url, CHECKLIST_PDF_BUCKET) ?? checklist.pdf_url;
      const signedUrl = await getChecklistPdfSignedUrl(path);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      logger.error('No se pudo abrir el PDF del checklist', error);
      toast.error('No se pudo abrir el PDF');
    } finally {
      setIsOpeningPdf(false);
    }
  };

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
          {emailBadge && (
            <Badge variant="outline" className={emailBadge.className} title={emailState?.last_error ?? undefined}>
              {emailBadge.label}
            </Badge>
          )}
          {checklist.crane_label && <Badge variant="outline">{checklist.crane_label}</Badge>}
          {checklist.service_folio && <Badge variant="outline">Folio {checklist.service_folio}</Badge>}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {checklist.pdf_url ? (
            <Button
              type="button"
              size="sm"
              className="min-h-11 flex-1 rounded-xl font-bold"
              disabled={isOpeningPdf}
              onClick={handleDownloadPdf}
            >
              <Download className="mr-2 size-4" />
              {isOpeningPdf ? 'Abriendo…' : 'Descargar PDF'}
            </Button>
          ) : (
            <span className="flex flex-1 items-center gap-1.5 text-sm text-muted-foreground">
              <FileText className="size-4" />
              Sin PDF generado
            </span>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11 rounded-xl"
            disabled={isGeneratingPdf}
            onClick={onRegeneratePdf}
          >
            <RefreshCw className={`mr-2 size-4 ${isGeneratingPdf ? 'animate-spin' : ''}`} />
            {isGeneratingPdf ? 'Generando…' : 'Regenerar PDF'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11 rounded-xl"
            disabled={isSendingEmail || !checklist.pdf_url}
            onClick={onResendEmail}
          >
            <Mail className="mr-2 size-4" />
            {isSendingEmail ? 'Encolando…' : 'Reenviar correo'}
          </Button>
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
