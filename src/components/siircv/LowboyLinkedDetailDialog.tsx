import { useEffect, useState } from 'react';
import { AlertTriangle, Link2, Unlink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { safeDateToDisplaySlashes } from '@/utils/timezoneUtils';
import {
  useLowboyLinkedDetail,
  type LinkedCostDetail,
  type LinkedServiceDetail,
} from '@/hooks/useSiiRcv';
import type { SiiRcvRecordRow } from '@/types/siiRcv';

const logger = createLogger('LowboyLinkedDetail');
const RECEIPT_BUCKET = 'quick-entry-photos';

const formatCLP = (value: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value) || 0);

const dash = (value: string | null | undefined): string => (value && String(value).trim() ? String(value) : '—');

/** Glosa del tipo de DTE del SII, para derivar el documento cuando faltan los campos manuales. */
const DTE_TIPO_LABEL: Record<number, string> = {
  33: 'Factura Electrónica',
  34: 'Factura Exenta',
  56: 'Nota de Débito',
  61: 'Nota de Crédito',
};

/**
 * Documento a mostrar, por orden de preferencia:
 *   1. document_type + document_number (dato manual del costo)
 *   2. derivado del DTE: glosa de dte_tipo + dte_folio
 */
function resolveDocumento(detail: LinkedCostDetail): string {
  if (detail.documentType || detail.documentNumber) {
    return [detail.documentType, detail.documentNumber].filter(Boolean).join(' · ');
  }
  if (detail.dteTipo != null) {
    const label = DTE_TIPO_LABEL[detail.dteTipo] ?? `Tipo ${detail.dteTipo}`;
    return detail.dteFolio != null ? `${label} · ${detail.dteFolio}` : label;
  }
  return '—';
}

function Field({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm">{value}</p>
    </div>
  );
}

function ConsistencyAlert({ costo, documento }: { costo: number; documento: number }) {
  if (Math.round(costo) === Math.round(documento)) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>El monto del vínculo ({formatCLP(costo)}) difiere del total del documento ({formatCLP(documento)}).</span>
    </div>
  );
}

function ReceiptThumbnails({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (paths.length === 0) { setUrls([]); return; }
      try {
        const results = await Promise.all(
          paths.map(async (path) => {
            const { data } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 60 * 60);
            return data?.signedUrl ?? '';
          }),
        );
        if (!cancelled) setUrls(results.filter(Boolean));
      } catch (e) {
        logger.warn('No se pudieron cargar miniaturas de comprobantes', e);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [paths]);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {paths.length} comprobante(s) adjunto(s)
      </p>
      {urls.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {urls.map((url, idx) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
              <img src={url} alt={`Comprobante ${idx + 1}`} className="h-20 w-full rounded-md border object-cover" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function CostBody({ detail, documentTotal }: { detail: LinkedCostDetail; documentTotal: number }) {
  const dte = [detail.dteTipo, detail.dteFolio].some((v) => v != null) || detail.dteRutEmisor
    ? `${dash(detail.dteTipo != null ? String(detail.dteTipo) : null)} · ${dash(detail.dteFolio != null ? String(detail.dteFolio) : null)}${detail.dteRutEmisor ? ` · ${detail.dteRutEmisor}` : ''}`
    : '—';
  const documento = resolveDocumento(detail);

  // Proveedor: si viene del DTE (sin supplier_id), etiquetamos el origen.
  const proveedor = detail.supplierName ? (
    <>
      {detail.supplierName}
      {detail.supplierSource === 'dte' && <span className="ml-1 text-xs text-muted-foreground">(desde DTE)</span>}
    </>
  ) : '—';

  // El folio de servicio en costos 'lowboy' suele ser el N° de factura (redundante con
  // el documento) y no un servicio real. Se oculta si es redundante o si es lowboy sin
  // servicio real asociado; se mantiene para costos G5N con servicio.
  const showServiceFolio = Boolean(detail.serviceFolio)
    && detail.serviceFolio !== detail.documentNumber
    && (detail.entity !== 'lowboy' || Boolean(detail.serviceId));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Costo vinculado</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{dash(detail.description)}</p>
        </div>
        <p className="whitespace-nowrap text-2xl font-bold">{formatCLP(detail.amount)}</p>
      </div>

      <ConsistencyAlert costo={detail.amount} documento={documentTotal} />

      <Separator />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Fecha" value={dash(detail.date ? safeDateToDisplaySlashes(detail.date) : null)} />
        <Field label="Fecha de pago" value={dash(detail.paymentDate ? safeDateToDisplaySlashes(detail.paymentDate) : null)} />
        <Field label="Categoría" value={dash(detail.categoryName)} />
        <Field label="Subcategoría" value={dash(detail.subcategory)} />
        <Field label="Centro de costo" value={dash(detail.costCenterName)} />
        <Field label="Proveedor" value={proveedor} />
        <Field label="Documento" value={documento} />
        <Field label="DTE" value={dte} />
        <Field label="Entidad" value={dash(detail.entity)} />
        <Field label="Pagado por" value={dash(detail.paidBy)} />
        {showServiceFolio && <Field label="Folio de servicio" value={detail.serviceFolio} />}
      </div>

      {detail.description && (
        <>
          <Separator />
          <Field label="Descripción" value={<span className="whitespace-pre-wrap">{detail.description}</span>} />
        </>
      )}
      {detail.notes && (
        <Field label="Notas" value={<span className="whitespace-pre-wrap">{detail.notes}</span>} />
      )}

      {detail.receiptPhotoPaths.length > 0 && (
        <>
          <Separator />
          <ReceiptThumbnails paths={detail.receiptPhotoPaths} />
        </>
      )}
    </div>
  );
}

function ServiceBody({ detail, documentNet }: { detail: LinkedServiceDetail; documentNet: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Servicio vinculado</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Folio {dash(detail.folio)}</p>
        </div>
        <p className="whitespace-nowrap text-2xl font-bold">{formatCLP(detail.value)}</p>
      </div>

      <ConsistencyAlert costo={detail.value} documento={documentNet} />

      <Separator />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Fecha del servicio" value={dash(detail.serviceDate ? safeDateToDisplaySlashes(detail.serviceDate) : null)} />
        <Field label="Estado" value={detail.status ? <Badge variant="secondary">{detail.status}</Badge> : '—'} />
        <Field label="Cliente" value={dash(detail.clientName)} />
        <Field label="Valor del servicio" value={formatCLP(detail.value)} />
        <Field label="Origen → Destino" value={`${dash(detail.origin)} → ${dash(detail.destination)}`} className="sm:col-span-2" />
      </div>
    </div>
  );
}

interface LowboyLinkedDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: SiiRcvRecordRow | null;
  /** Cierra este modal y abre el diálogo de vinculación existente para el mismo registro. */
  onChangeLink: () => void;
  /** Muestra el acceso "Cambiar vínculo" (solo admin). */
  canChangeLink?: boolean;
}

export function LowboyLinkedDetailDialog({ open, onOpenChange, record, onChangeLink, canChangeLink = false }: LowboyLinkedDetailDialogProps) {
  const { data, isLoading, isError } = useLowboyLinkedDetail(record, open);
  const isPurchase = record?.book_type === 'compra';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isPurchase ? 'Detalle del costo vinculado' : 'Detalle del servicio vinculado'}</DialogTitle>
          <DialogDescription>
            {record ? `Documento folio ${record.folio} por ${formatCLP(Number(record.total_amount))}.` : ''} Solo lectura.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          </div>
        ) : isError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>No fue posible cargar el detalle del vínculo. Inténtalo nuevamente.</span>
          </div>
        ) : !data || data.kind === 'deleted' ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Unlink className="size-8 text-muted-foreground" />
            <p className="font-medium">El registro vinculado ya no existe</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              El costo o servicio fue eliminado. Puedes desvincular este documento o vincularlo a otro registro.
            </p>
          </div>
        ) : data.kind === 'cost' ? (
          <CostBody detail={data} documentTotal={Number(record?.total_amount) || 0} />
        ) : (
          <ServiceBody detail={data} documentNet={Number(record?.net_amount) || 0} />
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          {canChangeLink && (
            <Button type="button" onClick={onChangeLink}>
              <Link2 className="mr-2 size-4" />
              Cambiar vínculo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
