import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DOCUMENT_TYPE_LABELS } from '@/types';
import { useMyDocumentStatus } from '@/hooks/operator/useMyDocumentStatus';

interface DocumentStatusBannerProps {
  operatorId?: string | null;
}

const formatDate = (iso: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : iso;
};

export const DocumentStatusBanner = ({ operatorId }: DocumentStatusBannerProps) => {
  const { data, isLoading, error } = useMyDocumentStatus(operatorId);

  if (!operatorId || isLoading || error) {
    return null;
  }

  const documents = data ?? [];
  const expiredDocuments = documents.filter((doc) => doc.docStatus === 'vencido');
  const expiringDocuments = documents.filter((doc) => doc.docStatus === 'por_vencer');

  if (expiredDocuments.length > 0) {
    return (
      <Alert variant="destructive" className="rounded-3xl border-danger/30 bg-danger-soft">
        <AlertTriangle className="size-4" />
        <AlertTitle>Tienes {expiredDocuments.length} documento(s) vencido(s)</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            No podras ser asignado a nuevos servicios hasta regularizarlos.
          </p>
          <ul className="space-y-1 text-xs text-danger-text/90">
            {expiredDocuments.map((doc) => (
              <li key={`${doc.documentType}-${doc.expiryDate}`}>
                {DOCUMENT_TYPE_LABELS[doc.documentType]}: vencio el {formatDate(doc.expiryDate)}
              </li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    );
  }

  if (expiringDocuments.length === 0) {
    return null;
  }

  return (
    <Alert variant="warning" className="rounded-3xl">
      <AlertTriangle className="size-4" />
      <AlertTitle>Documentos por vencer</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>Coordina su renovacion para mantenerte habilitado para nuevos servicios.</p>
        <ul className="space-y-1 text-xs">
          {expiringDocuments.map((doc) => (
            <li key={`${doc.documentType}-${doc.expiryDate}`}>
              {DOCUMENT_TYPE_LABELS[doc.documentType]}: vence el {formatDate(doc.expiryDate)} ({doc.daysUntil} dia(s) restantes)
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
};
