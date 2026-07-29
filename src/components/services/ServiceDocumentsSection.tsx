import { useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, FileText, Loader2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useServiceDocuments, type ServiceDocument } from '@/hooks/useServiceDocuments';
import { createDocumentSignedUrl, shareDocument } from '@/utils/documentShare';
import { businessClock } from '@/utils/businessClock';
import { cn } from '@/lib/utils';

const DOCUMENT_GONE_MESSAGE =
  'El archivo ya no está disponible en línea. Puede haber sido archivado por antigüedad.';

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
 * PDF al teléfono y reenviarlo a mano. "Compartir" abre el panel del sistema
 * —Mail, WhatsApp, lo que el usuario elija— con un enlace firmado de vida
 * corta. Sin registros ni flujos nuevos: es el puente mientras madura lo
 * medular.
 */
export const ServiceDocumentsSection = ({
  serviceId,
  folio,
  className,
}: ServiceDocumentsSectionProps) => {
  const { data: documents = [], isLoading } = useServiceDocuments(serviceId);
  const [busyId, setBusyId] = useState<string | null>(null);

  const titleFor = (document: ServiceDocument) => `${document.label} · ${folio}`;

  const handleShare = async (document: ServiceDocument) => {
    setBusyId(document.id);
    try {
      const outcome = await shareDocument({
        bucket: document.bucket,
        path: document.path,
        title: titleFor(document),
      });

      if (outcome === 'failed') toast.error(DOCUMENT_GONE_MESSAGE);
      if (outcome === 'copied') toast.success('Enlace copiado · pégalo donde quieras enviarlo');
      if (outcome === 'opened') toast.info('El documento se abrió en una pestaña nueva');
    } finally {
      setBusyId(null);
    }
  };

  const handleOpen = async (document: ServiceDocument) => {
    setBusyId(document.id);
    try {
      const url = await createDocumentSignedUrl(document);
      if (!url) {
        toast.error(DOCUMENT_GONE_MESSAGE);
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
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
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
          >
            <FileText className="size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{document.label}</p>
              {document.createdAt && (
                <p className="text-xs text-muted-foreground">
                  {businessClock.format(document.createdAt, 'dd/MM/yyyy HH:mm')}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
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
                size="sm"
                onClick={() => void handleShare(document)}
                disabled={isBusy}
                className="min-h-10"
              >
                {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
                Compartir
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
};
