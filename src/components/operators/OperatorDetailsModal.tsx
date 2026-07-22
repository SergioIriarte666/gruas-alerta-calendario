import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Operator, DOCUMENT_TYPE_LABELS, DocumentType } from '@/types';
import {
  User,
  Phone,
  Truck,
  CheckCircle,
  FileText,
  Briefcase,
  UserCog,
} from 'lucide-react';
import { formatForDisplayWithTime } from '@/utils/timezoneUtils';
import { OperatorDocumentsSection } from './OperatorDocumentsSection';
import { OperatorAppAccessBadge } from './OperatorAppAccessBadge';
import {
  useOperatorDocuments,
  getDocumentStatus,
  getDaysUntilExpiry,
} from '@/hooks/operators/useOperatorDocuments';

const DOCUMENT_TYPES_DISPLAY: DocumentType[] = [
  'cedula_identidad',
  'licencia_conducir',
  'examen_psicosensotecnico',
  'examen_altura',
  'seguro_vida',
];

interface OperatorDetailsModalProps {
  operator: (Operator & { services?: any[] }) | null;
  isOpen: boolean;
  onClose: () => void;
}

export const OperatorDetailsModal = ({ operator, isOpen, onClose }: OperatorDetailsModalProps) => {
  if (!operator) return null;

  return (
    <OperatorDetailsModalInner operator={operator} isOpen={isOpen} onClose={onClose} />
  );
};

// Inner component to allow hook calls (hooks can't be conditional at top level)
const OperatorDetailsModalInner = ({
  operator,
  isOpen,
  onClose,
}: {
  operator: Operator & { services?: any[] };
  isOpen: boolean;
  onClose: () => void;
}) => {
  const { documents, isLoading: docsLoading } = useOperatorDocuments(operator.id);
  const getDoc = (type: DocumentType) => documents.find((d) => d.documentType === type);

  const docBadge = (type: DocumentType) => {
    const doc = getDoc(type);
    if (!doc) {
      return <Badge variant="secondary">Sin documento</Badge>;
    }
    const status = getDocumentStatus(doc.expiryDate);
    switch (status) {
      case 'vigente':
        return (
          <Badge variant="outline" className="border-success text-success-text">
            Vigente
          </Badge>
        );
      case 'por_vencer':
        return (
          <Badge variant="outline" className="border-warning text-warning-text">
            Por vencer
          </Badge>
        );
      case 'vencido':
        return <Badge variant="destructive">Vencido</Badge>;
      default:
        return <Badge variant="secondary">Sin fecha</Badge>;
    }
  };

  const docExtraText = (type: DocumentType) => {
    const doc = getDoc(type);
    if (!doc) return null;
    const status = getDocumentStatus(doc.expiryDate);
    const days = getDaysUntilExpiry(doc.expiryDate);
    if (status === 'por_vencer' && days !== null) {
      return (
        <span className="text-xs text-warning-text">
          {days === 0 ? 'Vence hoy' : `Vence en ${days} días`}
        </span>
      );
    }
    if (status === 'vencido' && days !== null) {
      return (
        <span className="text-xs text-destructive">
          Vencido hace {Math.abs(days)} días
        </span>
      );
    }
    return null;
  };

  const formatExpiry = (type: DocumentType) => {
    const doc = getDoc(type);
    if (!doc?.expiryDate) return '—';
    const [y, m, d] = doc.expiryDate.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="resources-dialog w-full max-w-3xl border-border/70 bg-card h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-y-auto sm:rounded-lg rounded-none p-4 sm:p-6">
        <DialogHeader className="-mx-6 -mt-6 border-b border-border/70 bg-muted/20 px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <User className="size-5 text-primary" />
            {operator.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="mt-2">
          <TabsList className="mb-4 w-full sm:w-auto">
            <TabsTrigger value="info" className="flex-1 sm:flex-none">Información</TabsTrigger>
            <TabsTrigger value="documents" className="flex-1 sm:flex-none">Documentos</TabsTrigger>
          </TabsList>

          {/* ── Tab Información ── */}
          <TabsContent value="info" className="space-y-4">
            {/* Estado */}
            <div className="flex items-center gap-2">
              <Badge variant={operator.isActive ? 'default' : 'secondary'}>
                {operator.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
              {operator.isActive && <CheckCircle className="size-4 text-success" />}
              <OperatorAppAccessBadge operator={operator} />
            </div>

            {/* Información de Contacto */}
            <div className="rounded-lg border border-border border-l-4 border-l-info bg-info/5 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                <div className="rounded bg-info/10 p-1 text-info">
                  <Phone className="size-4" />
                </div>
                Información de Contacto
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {operator.phone && (
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Teléfono</span>
                    <p className="text-sm font-medium">{operator.phone}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">RUT</span>
                  <p className="text-sm font-medium">{operator.rut}</p>
                </div>
              </div>
            </div>

            {/* Información Laboral */}
            <div className="rounded-lg border border-border border-l-4 border-l-primary bg-primary/5 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                <div className="rounded bg-primary/10 p-1 text-primary">
                  <Briefcase className="size-4" />
                </div>
                Información Laboral
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Tipo</span>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {operator.operatorType === 'crane_operator' ? (
                      <>
                        <UserCog className="size-4 shrink-0 text-primary" />
                        <span>Operador de Grúa</span>
                      </>
                    ) : (
                      <>
                        <Briefcase className="size-4 shrink-0 text-info" />
                        <span>Personal Administrativo</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Cargo</span>
                  <p className="text-sm font-medium">{operator.position || 'Sin cargo'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">
                    {operator.operatorType === 'crane_operator' ? 'Licencia' : 'Departamento'}
                  </span>
                  <p className="text-sm font-medium">
                    {operator.operatorType === 'crane_operator'
                      ? operator.licenseNumber || 'Sin licencia'
                      : operator.department || 'Sin departamento'}
                  </p>
                </div>
                {operator.operatorType === 'crane_operator' && (
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Vencimiento Examen</span>
                    <p className="text-sm font-medium">
                      {operator.examExpiry ? formatForDisplayWithTime(operator.examExpiry) : 'Sin fecha'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Servicios del Día */}
            <div className="rounded-lg border border-border border-l-4 border-l-success bg-success/5 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                <div className="rounded bg-success/10 p-1 text-success">
                  <FileText className="size-4" />
                </div>
                Servicios del Día
                <Badge variant="outline">{operator.services?.length || 0}</Badge>
              </h3>

              {operator.services && operator.services.length > 0 ? (
                <div className="space-y-2">
                  {operator.services.slice(0, 5).map((service: any, index: number) => (
                    <div
                      key={service.id || index}
                      className="flex items-center justify-between p-2 bg-background rounded border"
                    >
                      <div className="flex items-center gap-2">
                        <Truck className="size-3 text-muted-foreground" />
                        <span className="text-sm">
                          Servicio {service.id?.slice(0, 8) || `#${index + 1}`}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {service.status || 'Programado'}
                      </Badge>
                    </div>
                  ))}
                  {operator.services.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">
                      y {operator.services.length - 5} servicios más...
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No hay servicios asignados para hoy</p>
              )}
            </div>

            {/* Licencias y Documentos */}
            <div className="rounded-lg border border-border border-l-4 border-l-warning bg-warning/5 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                <div className="rounded bg-warning/10 p-1 text-warning">
                  <FileText className="size-4" />
                </div>
                Licencias y Exámenes
              </h3>

              {docsLoading ? (
                <div className="space-y-3">
                  {DOCUMENT_TYPES_DISPLAY.map((type) => (
                    <div key={type} className="h-4 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {DOCUMENT_TYPES_DISPLAY.map((type) => (
                    <div
                      key={type}
                      className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-background/60 transition-colors"
                    >
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-sm text-foreground">
                        {DOCUMENT_TYPE_LABELS[type]}
                      </span>
                      {docBadge(type)}
                      <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                        {formatExpiry(type)}
                      </span>
                      <span className="w-32 shrink-0 text-right">
                        {docExtraText(type)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {operator.licenseNumber && (
                <p className="mt-3 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                  Número de licencia:{' '}
                  <span className="font-medium text-foreground">{operator.licenseNumber}</span>
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 border-t border-border/70 pt-4 text-sm text-muted-foreground">
              <span>
                Creado: {formatForDisplayWithTime(operator.createdAt)}
                {operator.creatorName && ` por ${operator.creatorName}`}
              </span>
              <span>Actualizado: {formatForDisplayWithTime(operator.updatedAt)}</span>
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline"
                className="border-border/70 bg-background/60"
                onClick={onClose}
              >
                Cerrar
              </Button>
            </div>
          </TabsContent>

          {/* ── Tab Documentos ── */}
          <TabsContent value="documents">
            <OperatorDocumentsSection operator={operator} />
            <div className="flex justify-end mt-6">
              <Button
                variant="outline"
                className="border-border/70 bg-background/60"
                onClick={onClose}
              >
                Cerrar
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
