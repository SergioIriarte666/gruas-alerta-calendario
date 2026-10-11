import { Download, Edit, Loader2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { businessClock } from '@/utils/businessClock';
import { getDocumentExpiryState } from '@/utils/businessDocuments';
import type { BusinessDocument } from '@/hooks/useBusinessDocuments';

export const formatDocumentDate = (value: string | null) => {
  if (!value) return '-';
  return businessClock.dateLabel(value, 'es-CL');
};

export const DocumentExpiryBadge = ({ expiresAt }: { expiresAt: string | null }) => {
  const state = getDocumentExpiryState(expiresAt);
  if (state === 'expired') {
    return <Badge className="border-danger/30 bg-danger/10 text-danger hover:bg-danger/10">Vencido</Badge>;
  }
  if (state === 'soon') {
    return <Badge className="border-warning/30 bg-warning/10 text-warning hover:bg-warning/10">Por vencer</Badge>;
  }
  if (state === 'valid') {
    return <Badge className="border-success/30 bg-success/10 text-success hover:bg-success/10">Vigente</Badge>;
  }
  return <Badge variant="outline">Sin vencimiento</Badge>;
};

export interface DocumentRowActionHandlers {
  onDownload: (document: BusinessDocument) => void;
  onEdit: (document: BusinessDocument) => void;
  onDelete: (document: BusinessDocument) => void;
  downloadingId: string | null;
}

interface DocumentRowActionsProps extends DocumentRowActionHandlers {
  document: BusinessDocument;
}

/** Botones Descargar / Editar / Eliminar de una fila; los usan la tabla y la vista Carpetas. */
export const DocumentRowActions = ({ document, onDownload, onEdit, onDelete, downloadingId }: DocumentRowActionsProps) => (
  <div className="flex justify-end gap-1">
    <Button
      variant="ghost"
      size="icon"
      onClick={() => onDownload(document)}
      disabled={downloadingId === document.id}
      title="Descargar"
      aria-label={`Descargar ${document.title}`}
    >
      {downloadingId === document.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
    </Button>
    <Button variant="ghost" size="icon" onClick={() => onEdit(document)} title="Editar" aria-label={`Editar ${document.title}`}>
      <Edit className="size-4" />
    </Button>
    <Button
      variant="ghost"
      size="icon"
      onClick={() => onDelete(document)}
      className="text-destructive hover:text-destructive"
      title="Eliminar"
      aria-label={`Eliminar ${document.title}`}
    >
      <Trash2 className="size-4" />
    </Button>
  </div>
);
