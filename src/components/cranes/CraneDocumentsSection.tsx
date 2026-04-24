import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePickerInput from '@/components/common/DatePickerInput';
import { 
  Calendar,
  Upload,
  Download,
  Eye,
  AlertTriangle,
  FileText,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Crane } from '@/types';
import { useCraneDocuments } from '@/hooks/useCraneDocuments';
import { parseFromDatabase, getCurrentChileDate, formatForDisplay } from '@/utils/timezoneUtils';
import { StatusBadge } from '@/components/ui/status-badge';

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
  const { documents, isLoading, uploading, uploadDocument, downloadDocument, getDocumentByType } = useCraneDocuments(crane.id);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<{[key: string]: File}>({});
  const [expiryDates, setExpiryDates] = useState<{[key: string]: string}>({});

  const getDaysUntilExpiry = (date: string) => {
    if (!date) return 0;
    const expiry = parseFromDatabase(date);
    const today = getCurrentChileDate();
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getExpiryStatus = (days: number) => {
    if (days <= 0) return 'danger';
    if (days <= 30) return 'warning';
    return 'success';
  };

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

  const DocumentCard = ({ type }: { type: typeof documentTypes[0] }) => {
    const document = getDocumentByType(type.key);
    const expiryDate = crane[type.craneField] as string;
    const daysUntilExpiry = expiryDate ? getDaysUntilExpiry(expiryDate) : 0;
    const status = getExpiryStatus(daysUntilExpiry);
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
              <FileText className="w-5 h-5" />
              {type.label}
            </span>
            {expiryDate && (
              <div className="flex items-center gap-2">
                  <StatusIcon className={`w-4 h-4 ${statusLabelColors[status]}`} />
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
                <span className="text-foreground">
                  {formatForDisplay(parseFromDatabase(expiryDate))}
                </span>
              </div>
            )}

            {document && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Archivo:</span>
                <span className="max-w-[150px] truncate text-foreground" title={document.fileName}>
                  {document.fileName}
                </span>
              </div>
            )}
          </div>

          {/* Acciones si hay documento */}
          {document && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadDocument(document)}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Descargar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(document.fileUrl, '_blank')}
                className="flex-1"
              >
                <Eye className="w-4 h-4 mr-2" />
                Ver
              </Button>
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
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
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
              <AlertTriangle className="w-5 h-5" />
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
    </div>
  );
};