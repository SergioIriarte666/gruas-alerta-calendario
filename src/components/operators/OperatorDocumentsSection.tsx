import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import DatePickerInput from '@/components/common/DatePickerInput';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Upload,
  Download,
  Eye,
  AlertTriangle,
  FileText,
  CheckCircle,
  Clock,
  Trash2,
  Plus,
} from 'lucide-react';
import { Operator, DocumentType, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES_WITH_EXPIRY } from '@/types';
import {
  useOperatorDocuments,
  getDocumentStatus,
  getDaysUntilExpiry,
} from '@/hooks/operators/useOperatorDocuments';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { createLogger } from '@/lib/logger';

const logger = createLogger('OperatorDocuments');

const ALL_DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[];

interface UploadFormState {
  documentType: DocumentType | '';
  expiryDate: string;
  issuedDate: string;
  notes: string;
  file: File | null;
}

const EMPTY_FORM: UploadFormState = {
  documentType: '',
  expiryDate: '',
  issuedDate: '',
  notes: '',
  file: null,
};

interface Props {
  operator: Operator;
}

export const OperatorDocumentsSection = ({ operator }: Props) => {
  const {
    documents,
    isLoading,
    uploading,
    uploadDocument,
    deleteDocument,
    isDeleting,
    downloadDocument,
    openDocument,
    activeDocumentId,
    activeDocumentAction,
  } =
    useOperatorDocuments(operator.id);
  const { isAdmin } = useUserPermissions();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [form, setForm] = useState<UploadFormState>(EMPTY_FORM);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const requiresExpiry = form.documentType
    ? DOCUMENT_TYPES_WITH_EXPIRY.includes(form.documentType as DocumentType)
    : false;

  const canSubmit =
    !!form.file &&
    !!form.documentType &&
    (!requiresExpiry || !!form.expiryDate);

  const handleSubmit = () => {
    if (!canSubmit || !form.documentType) return;
    logger.debug('Subiendo documento:', form.documentType, 'para operador:', operator.id);
    uploadDocument(
      {
        operatorId: operator.id,
        documentType: form.documentType as DocumentType,
        file: form.file!,
        expiryDate: form.expiryDate || undefined,
        issuedDate: form.issuedDate || undefined,
        notes: form.notes || undefined,
      },
      {
        onSuccess: () => {
          setIsUploadOpen(false);
          setForm(EMPTY_FORM);
        },
      },
    );
  };

  const statusTone = (status: ReturnType<typeof getDocumentStatus>) => {
    switch (status) {
      case 'vigente': return 'completed' as const;
      case 'por_vencer': return 'pending' as const;
      case 'vencido': return 'overdue' as const;
      default: return 'info' as const;
    }
  };

  const statusLabel = (status: ReturnType<typeof getDocumentStatus>, days: number | null) => {
    switch (status) {
      case 'vigente': return `Vigente (${days} días)`;
      case 'por_vencer': return days === 0 ? 'Vence hoy' : `Por vencer (${days} días)`;
      case 'vencido': return `Vencido (${Math.abs(days!)} días)`;
      default: return 'Sin fecha';
    }
  };

  const StatusIcon = (status: ReturnType<typeof getDocumentStatus>) => {
    switch (status) {
      case 'vigente': return <CheckCircle className="size-4 text-success" />;
      case 'por_vencer': return <Clock className="size-4 text-warning" />;
      case 'vencido': return <AlertTriangle className="size-4 text-danger" />;
      default: return <FileText className="size-4 text-muted-foreground" />;
    }
  };

  const cardBorder = (status: ReturnType<typeof getDocumentStatus>) => {
    switch (status) {
      case 'vigente': return 'border-success/30 bg-success/5';
      case 'por_vencer': return 'border-warning/30 bg-warning/5';
      case 'vencido': return 'border-danger/30 bg-danger/5';
      default: return 'border-border/60';
    }
  };

  const expiredDocs = documents.filter((d) => getDocumentStatus(d.expiryDate) === 'vencido');
  const expiringDocs = documents.filter((d) => getDocumentStatus(d.expiryDate) === 'por_vencer');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Cargando documentos...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h4 className="text-lg font-medium text-foreground">Gestión de Documentos</h4>
          <p className="text-sm text-muted-foreground">
            Documentos legales y laborales del operador
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone="info">
            {documents.length} / {ALL_DOCUMENT_TYPES.length} subidos
          </StatusBadge>
          <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setIsUploadOpen(true)}>
            <Plus className="size-4 mr-2" />
            Subir documento
          </Button>
        </div>
      </div>

      {/* Alertas globales */}
      {(expiredDocs.length > 0 || expiringDocs.length > 0) && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-foreground">
              <AlertTriangle className="size-4 text-warning" />
              Documentos que requieren atención
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {expiredDocs.map((d) => (
              <p key={d.id} className="text-sm text-danger">
                • {DOCUMENT_TYPE_LABELS[d.documentType]} —{' '}
                <strong>VENCIDO</strong> ({d.expiryDate})
              </p>
            ))}
            {expiringDocs.map((d) => {
              const days = getDaysUntilExpiry(d.expiryDate);
              return (
                <p key={d.id} className="text-sm text-warning">
                  • {DOCUMENT_TYPE_LABELS[d.documentType]} — vence en{' '}
                  <strong>{days} días</strong> ({d.expiryDate})
                </p>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Grid de documentos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ALL_DOCUMENT_TYPES.map((type) => {
          const doc = documents.find((d) => d.documentType === type);
          const status = getDocumentStatus(doc?.expiryDate);
          const days = getDaysUntilExpiry(doc?.expiryDate);

          return (
            <Card key={type} className={`border transition-all ${doc ? cardBorder(status) : 'border-border/60'}`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm text-foreground">
                  <span className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" />
                    {DOCUMENT_TYPE_LABELS[type]}
                  </span>
                  {doc && StatusIcon(status)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-3 sm:p-4">
                {doc ? (
                  <>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Estado</span>
                        <StatusBadge tone={statusTone(status)}>
                          {statusLabel(status, days)}
                        </StatusBadge>
                      </div>
                      {doc.expiryDate && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Vencimiento</span>
                          <span className="text-foreground">{doc.expiryDate}</span>
                        </div>
                      )}
                      {doc.issuedDate && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Emisión</span>
                          <span className="text-foreground">{doc.issuedDate}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Archivo</span>
                        <span
                          className="max-w-[140px] truncate text-foreground"
                          title={doc.fileName}
                        >
                          {doc.fileName}
                        </span>
                      </div>
                      {doc.notes && (
                        <p className="text-muted-foreground italic text-xs pt-1">{doc.notes}</p>
                      )}
                    </div>
                    <div className="space-y-2 pt-1">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={activeDocumentId === doc.id}
                          onClick={() => downloadDocument(doc)}
                        >
                          <Download className="size-3 mr-1" />
                          {activeDocumentId === doc.id && activeDocumentAction === 'download'
                            ? 'Firmando...'
                            : 'Descargar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={activeDocumentId === doc.id}
                          onClick={() => openDocument(doc)}
                        >
                          <Eye className="size-3 mr-1" />
                          {activeDocumentId === doc.id && activeDocumentAction === 'view'
                            ? 'Abriendo...'
                            : 'Ver'}
                        </Button>
                      </div>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-danger border-danger/30 hover:bg-danger/10 hover:text-danger"
                          onClick={() => setDeletingDocId(doc.id)}
                        >
                          <Trash2 className="size-3 mr-1" />
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground mb-2">Sin documento</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setForm({ ...EMPTY_FORM, documentType: type });
                        setIsUploadOpen(true);
                      }}
                    >
                      <Upload className="size-3 mr-1" />
                      Subir
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal de subida */}
      <Dialog open={isUploadOpen} onOpenChange={(open) => {
        setIsUploadOpen(open);
        if (!open) setForm(EMPTY_FORM);
      }}>
        <DialogContent className="w-full max-w-md border-border/70 bg-card h-[100dvh] sm:h-auto overflow-y-auto sm:rounded-lg rounded-none p-4 sm:p-6">
          <DialogHeader className="-mx-6 -mt-6 border-b border-border/70 bg-muted/20 px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <Upload className="size-5 text-primary" />
              Subir documento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Tipo de documento */}
            <div className="space-y-1">
              <Label>Tipo de documento <span className="text-danger">*</span></Label>
              <Select
                value={form.documentType}
                onValueChange={(v) => setForm((f) => ({ ...f, documentType: v as DocumentType }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {ALL_DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {DOCUMENT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Archivo */}
            <div className="space-y-1">
              <Label>Archivo <span className="text-danger">*</span></Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setForm((f) => ({ ...f, file }));
                }}
              />
              <p className="text-xs text-muted-foreground">PDF, JPG o PNG — máx. 10 MB</p>
            </div>

            {/* Fecha de vencimiento */}
            <div className="space-y-1">
              <Label>
                Fecha de vencimiento
                {requiresExpiry && <span className="text-danger"> *</span>}
              </Label>
              <DatePickerInput
                value={form.expiryDate}
                onChange={(v) => setForm((f) => ({ ...f, expiryDate: v }))}
                placeholder="Seleccionar fecha"
              />
            </div>

            {/* Fecha de emisión */}
            <div className="space-y-1">
              <Label>Fecha de emisión <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <DatePickerInput
                value={form.issuedDate}
                onChange={(v) => setForm((f) => ({ ...f, issuedDate: v }))}
                placeholder="Seleccionar fecha"
              />
            </div>

            {/* Notas */}
            <div className="space-y-1">
              <Label>Notas <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Textarea
                placeholder="Observaciones sobre el documento..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Acciones */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsUploadOpen(false);
                  setForm(EMPTY_FORM);
                }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={!canSubmit || uploading}
                onClick={handleSubmit}
              >
                {uploading ? (
                  <>
                    <Clock className="size-4 mr-2 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="size-4 mr-2" />
                    Subir
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
      <AlertDialog open={!!deletingDocId} onOpenChange={(open) => !open && setDeletingDocId(null)}>
        <AlertDialogContent className="border-border/70 bg-popover/95">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar documento</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el archivo permanentemente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={() => {
                if (deletingDocId) {
                  deleteDocument(deletingDocId, {
                    onSuccess: () => setDeletingDocId(null),
                  });
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
