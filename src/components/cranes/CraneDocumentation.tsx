import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Shield, 
  Calendar, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Download,
  Upload,
  Settings
} from 'lucide-react';
import { Crane } from '@/types';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { useDocumentAlerts } from '@/hooks/useDocumentAlerts';
import { useCraneDocuments } from '@/hooks/useCraneDocuments';
import { DocumentUploadModal } from './DocumentUploadModal';
import { DocumentSettingsForm } from './forms/DocumentSettingsForm';
import { useToast } from '@/components/ui/custom-toast';
import { businessClock } from '@/utils/businessClock';

interface CraneDocumentationProps {
  crane: Crane;
}

export const CraneDocumentation = ({ crane }: CraneDocumentationProps) => {
  const { toast } = useToast();
  const { data: documentAlerts = [] } = useDocumentAlerts(crane.id);
  const { uploadDocument, downloadDocument, getDocumentByType, uploading } = useCraneDocuments(crane.id);
  const [showSettingsForm, setShowSettingsForm] = useState(false);
  const [uploadModal, setUploadModal] = useState<{isOpen: boolean, documentType: string, documentName: string}>({
    isOpen: false,
    documentType: '',
    documentName: ''
  });

  const getDaysUntilExpiry = (date: string) => {
    const expiry = new Date(date);
    const today = businessClock.todayDate();
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getExpiryStatus = (days: number) => {
    if (days <= 0) {
      return {
        status: 'expired',
        icon: AlertTriangle,
        theme: {
          card: 'border-danger/20 bg-danger/5',
          icon: 'text-danger',
        },
      };
    }
    if (days <= 30) {
      return {
        status: 'warning',
        icon: Clock,
        theme: {
          card: 'border-warning/20 bg-warning/5',
          icon: 'text-warning',
        },
      };
    }
    return {
      status: 'valid',
      icon: CheckCircle,
      theme: {
        card: 'border-success/20 bg-success/5',
        icon: 'text-success',
      },
    };
  };

  const documents = [
    {
      name: 'Revisión Técnica',
      type: 'technical_review',
      expiryDate: crane.technicalReviewExpiry,
      icon: FileText,
      required: true
    },
    {
      name: 'Seguro',
      type: 'insurance',
      expiryDate: crane.insuranceExpiry,
      icon: Shield,
      required: true
    },
    {
      name: 'Permiso de Circulación',
      type: 'circulation_permit',
      expiryDate: crane.circulationPermitExpiry,
      icon: Calendar,
      required: true
    }
  ];

  const handleDownload = (docType: string) => {
    const document = getDocumentByType(docType as any);
    if (document) {
      downloadDocument(document);
    } else {
      toast({
        type: 'info',
        title: 'Documento no disponible',
        description: 'No hay documento disponible para descargar',
      });
    }
  };

  const handleUpload = (docType: string, docName: string) => {
    setUploadModal({
      isOpen: true,
      documentType: docType,
      documentName: docName
    });
  };

  const handleUploadSubmit = (file: File, expiryDate?: string) => {
    uploadDocument({
      craneId: crane.id,
      documentType: uploadModal.documentType,
      file,
      expiryDate
    });
    setUploadModal({ isOpen: false, documentType: '', documentName: '' });
  };

  const getDocumentCard = (doc: typeof documents[0]) => {
    const days = getDaysUntilExpiry(doc.expiryDate);
    const status = getExpiryStatus(days);
    const StatusIcon = status.icon;
    const alert = documentAlerts.find(a => a.documentType === doc.type);
    const hasDocument = getDocumentByType(doc.type as any);

    return (
      <Card key={doc.type} className={`border ${status.theme.card}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <doc.icon className={`size-5 ${status.theme.icon}`} />
              {doc.name}
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon className={`size-5 ${status.theme.icon}`} />
              {alert && (
                <Settings className="size-4 text-muted-foreground" />
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-muted-foreground text-sm">Fecha de Vencimiento</p>
            <p className="text-foreground font-medium">{formatForDisplay(doc.expiryDate)}</p>
          </div>

          <div>
            <p className="text-muted-foreground text-sm">Estado</p>
            <div className="flex items-center gap-2">
              {status.status === 'expired' && (
                <Badge variant="destructive">Vencido hace {Math.abs(days)} días</Badge>
              )}
              {status.status === 'warning' && (
                <Badge className="border-warning/30 bg-warning/10 text-warning">Vence en {days} días</Badge>
              )}
              {status.status === 'valid' && (
                <Badge className="border-success/30 bg-success/10 text-success">Vigente por {days} días</Badge>
              )}
            </div>
          </div>

          {alert && (
            <div>
              <p className="text-muted-foreground text-sm">Configuración de Alertas</p>
              <p className="text-primary text-sm">
                Recordatorio {alert.alertDays} días antes
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              className="border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => handleDownload(doc.type)}
              disabled={!hasDocument}
            >
              <Download className="size-4 mr-2" />
              {hasDocument ? 'Descargar' : 'No disponible'}
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => handleUpload(doc.type, doc.name)}
              disabled={uploading}
            >
              <Upload className="size-4 mr-2" />
              {uploading ? 'Subiendo...' : hasDocument ? 'Actualizar' : 'Subir'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const expiredDocs = documents.filter(doc => getDaysUntilExpiry(doc.expiryDate) <= 0);
  const soonToExpireDocs = documents.filter(doc => {
    const days = getDaysUntilExpiry(doc.expiryDate);
    return days > 0 && days <= 30;
  });

  return (
    <div className="space-y-6">
      {/* Alertas de Vencimiento */}
      {(expiredDocs.length > 0 || soonToExpireDocs.length > 0) && (
        <Card className="border-danger/20 bg-danger/5">
          <CardHeader>
            <CardTitle className="text-danger flex items-center gap-2">
              <AlertTriangle className="size-5" />
              Alertas de Documentación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {expiredDocs.length > 0 && (
                <div>
                  <p className="text-danger font-medium mb-2">Documentos Vencidos:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {expiredDocs.map(doc => (
                      <li key={doc.type} className="text-danger">
                        {doc.name} - Vencido hace {Math.abs(getDaysUntilExpiry(doc.expiryDate))} días
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {soonToExpireDocs.length > 0 && (
                <div>
                  <p className="text-warning font-medium mb-2">Por Vencer:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {soonToExpireDocs.map(doc => (
                      <li key={doc.type} className="text-warning">
                        {doc.name} - Vence en {getDaysUntilExpiry(doc.expiryDate)} días
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado General de Documentación */}
      <Card className="bg-card border-border/70">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            Estado de Documentación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground mb-1">
                {documents.filter(doc => getDaysUntilExpiry(doc.expiryDate) > 30).length}
              </div>
              <div className="text-success text-sm">Vigentes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground mb-1">
                {soonToExpireDocs.length}
              </div>
              <div className="text-warning text-sm">Por Vencer</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground mb-1">
                {expiredDocs.length}
              </div>
              <div className="text-danger text-sm">Vencidos</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documentos Detallados */}
      <div>
        <h3 className="text-xl font-semibold text-foreground mb-4">Documentos</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {documents.map(getDocumentCard)}
        </div>
      </div>

      {/* Recordatorios y Configuración */}
      <Card className="bg-card border-border/70">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="size-5 text-primary" />
              Configuración de Recordatorios
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => setShowSettingsForm(true)}
            >
              <Settings className="size-4 mr-2" />
              Configurar Alertas
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {documents.map(doc => {
                const alert = documentAlerts.find(a => a.documentType === doc.type);
                return (
                  <div key={doc.type} className="p-3 border border-border/70 bg-muted/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <doc.icon className="size-4 text-primary" />
                      <span className="text-foreground text-sm font-medium">{doc.name}</span>
                    </div>
                    {alert ? (
                      <div className="text-xs">
                        <p className="text-success">✓ Alertas configuradas</p>
                        <p className="text-muted-foreground">
                          Recordatorio: {alert.alertDays} días antes
                        </p>
                        <p className="text-muted-foreground">
                          Email: {alert.emailNotifications ? 'Sí' : 'No'}
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-xs">Sin alertas configuradas</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulario de Configuración */}
      <DocumentSettingsForm
        isOpen={showSettingsForm}
        onClose={() => setShowSettingsForm(false)}
        craneId={crane.id}
        documents={documents}
        existingAlerts={documentAlerts}
      />

      {/* Modal de Upload */}
      <DocumentUploadModal
        isOpen={uploadModal.isOpen}
        onClose={() => setUploadModal({ isOpen: false, documentType: '', documentName: '' })}
        onUpload={handleUploadSubmit}
        documentType={uploadModal.documentType}
        documentName={uploadModal.documentName}
        uploading={uploading}
      />
    </div>
  );
};
