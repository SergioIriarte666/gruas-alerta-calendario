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

interface CraneDocumentationProps {
  crane: Crane;
}

export const CraneDocumentation = ({ crane }: CraneDocumentationProps) => {
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
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getExpiryStatus = (days: number) => {
    if (days <= 0) return { status: 'expired', color: 'red', icon: AlertTriangle };
    if (days <= 30) return { status: 'warning', color: 'yellow', icon: Clock };
    return { status: 'valid', color: 'green', icon: CheckCircle };
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
      alert('No hay documento disponible para descargar');
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
      <Card key={doc.type} className={`border-${status.color}-500/30 bg-${status.color}-500/5`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <doc.icon className={`size-5 text-${status.color}-400`} />
              {doc.name}
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon className={`size-5 text-${status.color}-400`} />
              {alert && (
                <Settings className="size-4 text-gray-400" />
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-gray-300 text-sm">Fecha de Vencimiento</p>
            <p className="text-white font-medium">{formatForDisplay(doc.expiryDate)}</p>
          </div>

          <div>
            <p className="text-gray-300 text-sm">Estado</p>
            <div className="flex items-center gap-2">
              {status.status === 'expired' && (
                <Badge variant="destructive">Vencido hace {Math.abs(days)} días</Badge>
              )}
              {status.status === 'warning' && (
                <Badge className="bg-yellow-500/20 text-yellow-400">Vence en {days} días</Badge>
              )}
              {status.status === 'valid' && (
                <Badge className="bg-green-500/20 text-green-400">Vigente por {days} días</Badge>
              )}
            </div>
          </div>

          {alert && (
            <div>
              <p className="text-gray-300 text-sm">Configuración de Alertas</p>
              <p className="text-tms-green text-sm">
                Recordatorio {alert.alertDays} días antes
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              className="border-tms-green/50 text-tms-green hover:bg-tms-green/10"
              onClick={() => handleDownload(doc.type)}
              disabled={!hasDocument}
            >
              <Download className="size-4 mr-2" />
              {hasDocument ? 'Descargar' : 'No disponible'}
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="border-tms-green/50 text-tms-green hover:bg-tms-green/10"
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
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="size-5" />
              Alertas de Documentación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {expiredDocs.length > 0 && (
                <div>
                  <p className="text-red-300 font-medium mb-2">Documentos Vencidos:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {expiredDocs.map(doc => (
                      <li key={doc.type} className="text-red-200">
                        {doc.name} - Vencido hace {Math.abs(getDaysUntilExpiry(doc.expiryDate))} días
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {soonToExpireDocs.length > 0 && (
                <div>
                  <p className="text-yellow-300 font-medium mb-2">Por Vencer:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {soonToExpireDocs.map(doc => (
                      <li key={doc.type} className="text-yellow-200">
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
      <Card className="bg-white/5 border-tms-green/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="size-5 text-tms-green" />
            Estado de Documentación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-1">
                {documents.filter(doc => getDaysUntilExpiry(doc.expiryDate) > 30).length}
              </div>
              <div className="text-green-400 text-sm">Vigentes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-1">
                {soonToExpireDocs.length}
              </div>
              <div className="text-yellow-400 text-sm">Por Vencer</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-1">
                {expiredDocs.length}
              </div>
              <div className="text-red-400 text-sm">Vencidos</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documentos Detallados */}
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Documentos</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {documents.map(getDocumentCard)}
        </div>
      </div>

      {/* Recordatorios y Configuración */}
      <Card className="bg-white/5 border-tms-green/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="size-5 text-tms-green" />
              Configuración de Recordatorios
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="border-tms-green/50 text-tms-green"
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
                  <div key={doc.type} className="p-3 border border-gray-700 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <doc.icon className="size-4 text-tms-green" />
                      <span className="text-white text-sm font-medium">{doc.name}</span>
                    </div>
                    {alert ? (
                      <div className="text-xs">
                        <p className="text-tms-green">✓ Alertas configuradas</p>
                        <p className="text-gray-400">
                          Recordatorio: {alert.alertDays} días antes
                        </p>
                        <p className="text-gray-400">
                          Email: {alert.emailNotifications ? 'Sí' : 'No'}
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-400 text-xs">Sin alertas configuradas</p>
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