import { differenceInCalendarDates } from '@/utils/calendarDate';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePickerInput from '@/components/common/DatePickerInput';
import { AlertAcknowledgementDialog } from '@/components/documents/AlertAcknowledgementDialog';
import {
  Upload,
  Download,
  Eye,
  AlertTriangle,
  FileText,
  CheckCircle,
  Clock,
  BellOff,
} from 'lucide-react';
import { Crane } from '@/types';
import { useAlertAcknowledgements, useCreateAlertAcknowledgement } from '@/hooks/useAlertAcknowledgements';
import { useCraneDocuments } from '@/hooks/useCraneDocuments';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { getCraneDocumentAlertKey } from '@/lib/documentAlertKeys';
import { parseFromDatabase, getCurrentChileDate, formatForDisplay } from '@/utils/timezoneUtils';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';

interface CraneDocumentsSectionProps {
  crane: Crane;
}

const documentTypes = [
  { 
    key: 'technical_review' as const, 
    label: 'Revisión Técnica',
    craneField: 'technicalReviewExpiry' as keyof Crane
  },
  { 
    key: 'insurance' as const, 
    label: 'Seguro',
    craneField: 'insuranceExpiry' as keyof Crane
  },
  { 
    key: 'circulation_permit' as const, 
    label: 'Permiso Circulación',
    craneField: 'circulationPermitExpiry' as keyof Crane
  }
];

export const CraneDocumentsSection = ({ crane }: CraneDocumentsSectionProps) => {
  const { documents, isLoading, uploading: _uploading, uploadDocument, downloadDocument, getDocumentByType } = useCraneDocuments(crane.id);
  const { user, isAdmin } = useUserPermissions();
  const createAcknowledgement = useCreateAlertAcknowledgement();
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<{[key: string]: File}>({});
  const [expiryDates, setExpiryDates] = useState<{[key: string]: string}>({});
  const [acknowledgementTarget, setAcknowledgementTarget] = useState<{
    documentId: string;
    label: string;
    alertKey: string;
    expiryDate: string;
  } | null>(null);

  const getDaysUntilExpiry = (date: string) => {
    if (!date) return 0;
    const expiry = parseFromDatabase(date);
    const today = getCurrentChileDate();
    const diffTime = differenceInCalendarDates(expiry, today);
    return diffTime;
  };

  const getExpiryStatus = (days: number) => {
    if (days <= 0) return 'danger';
    if (days <= 30) return 'warning';
    return 'success';
  };

  const acknowledgementItems = documents
    .filter((doc) => Boolean(doc.expiryDate))
    .map((doc) => {
      const daysUntilExpiry = doc.expiryDate ? getDaysUntilExpiry(doc.expiryDate) : null;
      const alertStatus = daysUntilExpiry !== null && daysUntilExpiry < 0 ? 'vencido' : 'por_vencer';
      return {
        alertKey: getCraneDocumentAlertKey(doc.id, alertStatus),
        docExpiryDate: doc.expiryDate ?? null,
      };
    });

  const { isAcknowledged } = useAlertAcknowledgements(acknowledgementItems);

  const handleFileSelect = (type: string, file: File) => {
    setSelectedFiles(prev => ({ ...prev, [type]: file }));
  };

  const handleUpload = async (type: string) => {
    const file = selectedFiles[type];
    const expiryDate = expiryDates[type];
    
    if (!file) return;

    setUploadingType(type);
    try {
      await uploadDocument({
        craneId: crane.id,
        documentType: type,
        file,
        expiryDate
      });
      
      // Clear form
      setSelectedFiles(prev => ({ ...prev, [type]: undefined }));
      setExpiryDates(prev => ({ ...prev, [type]: '' }));
    } finally {
      setUploadingType(null);
    }
  };

  const handleSilenceAlert = async (notes: string) => {
    if (!acknowledgementTarget || !user?.id) return;

    try {
      await createAcknowledgement.mutateAsync({
        alertKey: acknowledgementTarget.alertKey,
        docExpiryDate: acknowledgementTarget.expiryDate,
        acknowledgedBy: user.id,
        notes,
      });
      toast.success('Alerta silenciada hasta la renovación del documento');
      setAcknowledgementTarget(null);
    } catch (error: any) {
      if (error?.code === '23505') {
        toast.info('Ya estaba silenciada');
        setAcknowledgementTarget(null);
        return;
      }
      toast.error(error?.message ?? 'No se pudo silenciar la alerta');
    }
  };

  const DocumentCard = ({ type }: { type: typeof documentTypes[0] }) => {
    const document = getDocumentByType(type.key);
    const expiryDate = crane[type.craneField] as string;
    const daysUntilExpiry = expiryDate ? getDaysUntilExpiry(expiryDate) : 0;
    const status = getExpiryStatus(daysUntilExpiry);
    const alertStatus = expiryDate ? (daysUntilExpiry < 0 ? 'vencido' : 'por_vencer') : null;
    const alertKey = document && alertStatus ? getCraneDocumentAlertKey(document.id, alertStatus) : null;
    const canSilenceAlert = Boolean(isAdmin && document && expiryDate && daysUntilExpiry <= 30);
    const isAlertAcknowledged = alertKey && expiryDate ? isAcknowledged(alertKey, expiryDate) : false;
    const selectedFile = selectedFiles[type.key];
    const isUploading = uploadingType === type.key;

    const statusColors = {
      success: 'border-success/30 bg-success-soft/40',
      warning: 'border-warning/30 bg-warning-soft/40',
      danger: 'border-danger/30 bg-danger-soft/40'
    };

    const statusLabelColors = {
      success: 'text-success',
      warning: 'text-warning',
      danger: 'text-danger'
    };

    const statusIcons = {
      success: CheckCircle,
      warning: Clock,
      danger: AlertTriangle
    };

    const StatusIcon = statusIcons[status];

    return (
      <Card className={`${statusColors[status]} border transition-all hover:border-opacity-50`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-foreground">
            <span className="flex items-center gap-2">
              <FileText className="size-5" />
              {type.label}
            </span>
            {expiryDate && (
              <div className="flex items-center gap-2">
                  <StatusIcon className={`size-4 ${statusLabelColors[status]}`} />
                  <StatusBadge tone={status === 'success' ? 'completed' : status === 'warning' ? 'pending' : 'overdue'}>
                  {daysUntilExpiry} días
                  </StatusBadge>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Estado actual */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Estado:</span>
                <span className={document ? 'text-success' : 'text-warning'}>
                {document ? 'Subido' : 'Sin subir'}
              </span>
            </div>
            
            {expiryDate && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Vencimiento:</span>
                <div className="flex items-center gap-2">
                  {isAlertAcknowledged && <Badge variant="secondary">Silenciada</Badge>}
                  <span className="text-foreground">
                    {formatForDisplay(expiryDate)}
                  </span>
                </div>
              </div>
            )}

            {document && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Archivo:</span>
                <span className="max-w-36 truncate text-foreground" title={document.fileName}>
                  {document.fileName}
                </span>
              </div>
            )}
          </div>

          {/* Acciones si hay documento */}
          {document && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadDocument(document)}
                  className="flex-1"
                >
                  <Download className="size-4 mr-2" />
                  Descargar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(document.fileUrl, '_blank')}
                  className="flex-1"
                >
                  <Eye className="size-4 mr-2" />
                  Ver
                </Button>
              </div>
              {canSilenceAlert && alertKey && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={createAcknowledgement.isPending}
                  onClick={() => setAcknowledgementTarget({
                    documentId: document.id,
                    label: type.label,
                    alertKey,
                    expiryDate,
                  })}
                >
                  <BellOff className="size-4 mr-2" />
                  Silenciar alerta WhatsApp
                </Button>
              )}
            </div>
          )}

          {/* Formulario de subida */}
          <div className="space-y-3 border-t border-border pt-3">
            <div>
              <Label htmlFor={`file-${type.key}`} className="text-sm text-foreground">
                {document ? 'Actualizar documento' : 'Subir documento'}
              </Label>
              <Input
                id={`file-${type.key}`}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(type.key, file);
                }}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor={`expiry-${type.key}`} className="text-sm text-foreground">
                Fecha de vencimiento
              </Label>
              <DatePickerInput
                id={`expiry-${type.key}`}
                value={expiryDates[type.key] || ''}
                onChange={(value) => setExpiryDates(prev => ({ ...prev, [type.key]: value }))}
                placeholder="Seleccionar fecha"
                className="mt-1"
              />
            </div>

            <Button
              onClick={() => handleUpload(type.key)}
              disabled={!selectedFile || isUploading}
              className="w-full"
              size="sm"
            >
              {isUploading ? (
                <>
                  <Clock className="size-4 mr-2 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="size-4 mr-2" />
                  {document ? 'Actualizar' : 'Subir'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando documentos...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h4 className="text-lg font-medium text-foreground">Gestión de Documentos</h4>
          <p className="text-sm text-muted-foreground">Sube y gestiona los documentos legales de la grúa</p>
        </div>
        <StatusBadge tone="info">
          {documents.length} documento{documents.length !== 1 ? 's' : ''} subido{documents.length !== 1 ? 's' : ''}
        </StatusBadge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {documentTypes.map((type) => (
          <DocumentCard key={type.key} type={type} />
        ))}
      </div>

      {/* Alertas globales */}
      {documentTypes.some(type => {
        const expiryDate = crane[type.craneField] as string;
        return expiryDate && getDaysUntilExpiry(expiryDate) <= 30;
      }) && (
        <Card className="mt-6 border-warning/30 bg-warning-soft/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="size-5" />
              Documentos por Vencer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {documentTypes.map(type => {
                const expiryDate = crane[type.craneField] as string;
                const days = expiryDate ? getDaysUntilExpiry(expiryDate) : 0;
                
                if (!expiryDate || days > 30) return null;
                
                return (
                  <p key={type.key} className="text-sm text-foreground">
                    • {type.label} {days <= 0 ? 'vencido' : `vence en ${days} días`}
                  </p>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <AlertAcknowledgementDialog
        open={!!acknowledgementTarget}
        onOpenChange={(open) => !open && setAcknowledgementTarget(null)}
        title="Silenciar alerta WhatsApp"
        description={
          acknowledgementTarget
            ? `La alerta de ${acknowledgementTarget.label} quedará silenciada hasta que cambie la fecha de vencimiento del documento.`
            : ''
        }
        isSubmitting={createAcknowledgement.isPending}
        onConfirm={handleSilenceAlert}
      />
    </div>
  );
};
