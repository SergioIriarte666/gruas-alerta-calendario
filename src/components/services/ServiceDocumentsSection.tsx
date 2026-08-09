import { useState } from 'react';
import { toast } from 'sonner';
import { Archive, Download, ExternalLink, FileText, Loader2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useServiceDocuments, type ServiceDocument } from '@/hooks/useServiceDocuments';
import { downloadDocumentFromUrl, shareDocument } from '@/utils/documentShare';
import { createServiceDocumentUrl } from '@/utils/serviceDocumentAccess';
import { businessClock } from '@/utils/businessClock';
import { cn } from '@/lib/utils';

const DOCUMENT_GONE_MESSAGE =
  'No se pudo recuperar el documento. Intenta nuevamente en unos momentos.';

interface ServiceDocumentsSectionProps {
  serviceId: string;
  folio: string;
  className?: string;
}

/**
 * Documentos del expediente, con recuperar y compartir en el mismo lugar.
 *
 * Mientras los envíos automáticos al cliente están apagados por decisión del
 * dueño, la entrega de documentos es manual: hasta hoy había que descargar el
 * PDF al teléfono y reenviarlo a mano. La sección resuelve automáticamente el
 * origen vigente (Storage o R2) y entrega el archivo al panel del sistema cuando
 * el dispositivo lo permite. Sin registros ni flujos nuevos: es el puente
 * mientras madura lo medular.
 */
export const ServiceDocumentsSection = ({
  serviceId,
  folio,
  className,
}: ServiceDocumentsSectionProps) => {
  const { data: documents = [], isLoading } = useServiceDocuments(serviceId);
  const [busyId, setBusyId] = useState<string | null>(null);

  const titleFor = (document: ServiceDocument) => `${document.label} · ${folio}`;
  const fileNameFor = (document: ServiceDocument) => {
    const safeFolio = folio.replace(/[^a-zA-Z0-9_-]/g, '-');
    const prefix = document.phase === 'initial' ? 'inspeccion-inicial' : 'entrega';
    return `${prefix}-${safeFolio}.pdf`;
  };
  const shareableFor = (document: ServiceDocument) => ({
    bucket: document.bucket,
    path: document.path,
    title: titleFor(document),
    fileName: fileNameFor(document),
  });

  const resolveUrl = async (document: ServiceDocument) => {
    try {
      return await createServiceDocumentUrl(document);
    } catch {
      return null;
    }
  };

  const handleShare = async (document: ServiceDocument) => {
    setBusyId(document.id);
    try {
      const url = await resolveUrl(document);
      if (!url) {
        toast.error(DOCUMENT_GONE_MESSAGE);
        return;
      }
      const outcome = await shareDocument(shareableFor(document), url);

      if (outcome === 'failed') toast.error(DOCUMENT_GONE_MESSAGE);
      if (outcome === 'copied') toast.success('Enlace copiado · pégalo donde quieras enviarlo');
      if (outcome === 'opened') toast.info('El documento se abrió en una pestaña nueva');
    } finally {
      setBusyId(null);
    }
  };

  const handleOpen = async (document: ServiceDocument) => {
    setBusyId(document.id);
    const pendingWindow = window.open('about:blank', '_blank');
    try {
      const url = await resolveUrl(document);
      if (!url) {
        pendingWindow?.close();
        toast.error(DOCUMENT_GONE_MESSAGE);
        return;
      }
      if (pendingWindow) {
        pendingWindow.opener = null;
        pendingWindow.location.replace(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (document: ServiceDocument) => {
    setBusyId(document.id);
    try {
      const url = await resolveUrl(document);
      if (!url) {
        toast.error(DOCUMENT_GONE_MESSAGE);
        return;
      }
      const outcome = await downloadDocumentFromUrl(url, shareableFor(document));
      if (outcome === 'downloaded') toast.success(`Descargando ${fileNameFor(document)}`);
      if (outcome === 'opened') toast.info('El documento se abrió para que puedas guardarlo');
      if (outcome === 'failed') toast.error(DOCUMENT_GONE_MESSAGE);
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>Cargando documentos…</p>
    );
  }

  if (documents.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        Todavía no hay documentos en el expediente de este servicio.
      </p>
    );
  }

  return (
    <ul className={cn('space-y-2', className)}>
      {documents.map((document) => {
        const isBusy = busyId === document.id;
        return (
          <li
            key={document.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-sm transition-colors hover:border-primary/25"
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{document.label}</p>
                {document.storageTier === 'cold' && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    <Archive className="size-3" />
                    Archivo histórico
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {document.createdAt
                  ? businessClock.format(document.createdAt, 'dd/MM/yyyy HH:mm')
                  : 'Fecha no disponible'}
                {document.storageTier === 'cold' ? ' · acceso privado temporal' : ''}
              </p>
            </div>
            <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleOpen(document)}
                disabled={isBusy}
                className="min-h-10"
              >
                <ExternalLink className="size-4" />
                Ver
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleDownload(document)}
                disabled={isBusy}
                className="min-h-10"
              >
                <Download className="size-4" />
                Descargar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleShare(document)}
                disabled={isBusy}
                className="min-h-10"
              >
                {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
                <span className="hidden sm:inline">Compartir</span>
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
};
