import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Cost } from '@/types/costs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Calendar, 
  DollarSign, 
  FileText, 
  Tag,
  Truck,
  User,
  Wrench,
  Building,
  Hash,
  MapPin,
  Navigation,
  Users,
  Car,
  Copy,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseFromDatabase, formatForDisplayWithTime } from '@/utils/timezoneUtils';
import { getCreatorDisplayName } from '@/types/common';
import { CostTraceabilityPanel } from './CostTraceabilityPanel';
import { supabase } from '@/integrations/supabase/client';
import { useCostChangeHistory } from '@/hooks/useChangeHistory';
import { ChangeHistoryPanel } from '@/components/shared/ChangeHistoryPanel';
import { generateCostDetailPDF } from '@/utils/pdf/costDetailPdfGenerator';
import { triggerFileDownload } from '@/utils/fileDownload';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/components/ui/custom-toast';
import { createLogger } from "@/lib/logger";


const logger = createLogger("CostDetailsModal");
interface CostDetailsModalProps {
  cost: Cost;
  isOpen: boolean;
  onClose: () => void;
  onDuplicate?: (cost: Cost) => void;
}

interface DetailItemProps {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  isFullWidth?: boolean;
}

const DetailItem = ({ icon: Icon, label, value, valueClass = '', isFullWidth = false }: DetailItemProps) => (
  <div className={`flex items-start gap-x-3 ${isFullWidth ? 'col-span-1 md:col-span-2' : ''}`}>
    <Icon className="size-4 text-muted-foreground mt-1 flex-shrink-0" />
    <div className="flex-grow">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`font-medium text-foreground ${valueClass}`}>{value || 'N/A'}</p>
    </div>
  </div>
);

interface DetailSectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

const DetailSection = ({ title, icon: Icon, children }: DetailSectionProps) => (
  <div>
    <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
      <Icon className="size-5 mr-2 text-primary"/>
      {title}
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
      {children}
    </div>
  </div>
);

export const CostDetailsModal = ({ cost, isOpen, onClose, onDuplicate }: CostDetailsModalProps) => {
  return <CostDetailsModalInner cost={cost} isOpen={isOpen} onClose={onClose} onDuplicate={onDuplicate} />;
};

const CostHistoryTabContent: React.FC<{ costId: string }> = ({ costId }) => {
  const { data, isLoading } = useCostChangeHistory(costId);
  return <ChangeHistoryPanel changes={data || []} isLoading={isLoading} />;
};

const CostDetailsModalInner = ({ cost, isOpen, onClose, onDuplicate }: CostDetailsModalProps) => {
  const receiptPhotoPaths = (((cost as any).receipt_photo_paths as string[] | null) || []).filter(Boolean);
  const [receiptUrls, setReceiptUrls] = React.useState<string[]>([]);
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);
  const { settings } = useSettings();
  const { toast } = useToast();

  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true);
      const safeSettings = {
        ...(settings || {}),
        company: (settings as any)?.company || {
          name: 'Empresa',
          rut: '',
          address: '',
          phone: '',
          email: '',
          website: '',
        },
      } as any;
      const { blob, fileName } = await generateCostDetailPDF({ cost, settings: safeSettings });
      const url = URL.createObjectURL(blob);
      triggerFileDownload(url, fileName);
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast({ title: 'PDF generado', description: 'La descarga del detalle del costo ha comenzado.', type: 'success' });
    } catch (e) {
      logger.error('Error generating cost detail PDF', e);
      toast({ title: 'Error al generar PDF', description: 'No se pudo generar el detalle. Inténtalo nuevamente.', type: 'error' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!isOpen || receiptPhotoPaths.length === 0) {
        setReceiptUrls([]);
        return;
      }
      const results = await Promise.all(
        receiptPhotoPaths.map(async (path) => {
          const { data } = await supabase.storage
            .from('quick-entry-photos')
            .createSignedUrl(path, 60 * 60 * 24 * 7);
          return data?.signedUrl || '';
        })
      );
      if (!cancelled) setReceiptUrls(results.filter(Boolean));
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, receiptPhotoPaths.join('|')]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getAssociatedInfo = () => {
    if (cost.cranes) {
      return {
        type: 'Grúa',
        icon: Truck,
        details: `${cost.cranes.brand} ${cost.cranes.model} (${cost.cranes.license_plate})`
      };
    }
    if (cost.operators) {
      return {
        type: 'Operador',
        icon: User,
        details: `${cost.operators.name} (${cost.operators.rut})`
      };
    }
    if (cost.services) {
      return {
        type: 'Servicio',
        icon: Wrench,
        details: `Folio: ${cost.services.folio}`
      };
    }
    return null;
  };

  const associatedInfo = getAssociatedInfo();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-border/70 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detalles del Costo - {cost.description}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="flex items-center gap-2 border-border/70 bg-background/60"
              >
                <Download className="size-4" />
                {isDownloadingPdf ? 'Generando...' : 'Descargar PDF'}
              </Button>
              {onDuplicate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onDuplicate(cost);
                    onClose();
                  }}
                  className="flex items-center gap-1 border-border/70 bg-background/60"
                >
                  <Copy className="size-4" />
                  Duplicar
                </Button>
              )}
              <Badge className="border-danger/20 bg-danger/10 text-danger hover:bg-danger/10">
                {formatCurrency(Number(cost.amount))}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4 border border-border/70 bg-muted/30">
            <TabsTrigger value="general">Información General</TabsTrigger>
            <TabsTrigger value="details">Detalles</TabsTrigger>
            <TabsTrigger value="associations">Asociaciones</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="mt-6">
            <div className="space-y-6">
              <DetailSection title="Información Básica" icon={FileText}>
                <DetailItem 
                  icon={FileText} 
                  label="Descripción" 
                  value={cost.description} 
                  valueClass="text-lg" 
                />
                <DetailItem 
                  icon={Tag} 
                  label="Categoría" 
                  value={cost.subcategory 
                    ? `${cost.cost_categories?.name} > ${cost.subcategory}` 
                    : cost.cost_categories?.name || 'Sin categoría'
                  } 
                />
                <DetailItem 
                  icon={Calendar} 
                  label="Fecha" 
                  value={format(parseFromDatabase(cost.date), 'dd/MM/yyyy', { locale: es })} 
                />
                <DetailItem 
                  icon={DollarSign} 
                  label="Monto" 
                  value={formatCurrency(Number(cost.amount))} 
                  valueClass="text-lg text-destructive font-bold" 
                />
              </DetailSection>

              <Separator className="border-border"/>
              <DetailSection title="Notas" icon={FileText}>
                <div className="col-span-1 md:col-span-2">
                  <div className="bg-muted/50 rounded-lg p-4 border">
                    <p className="text-muted-foreground whitespace-pre-wrap min-h-[60px]">
                      {cost.notes || 'Sin notas adicionales'}
                    </p>
                  </div>
                </div>
              </DetailSection>

              {receiptUrls.length > 0 && (
                <>
                  <Separator className="border-border"/>
                  <DetailSection title="Comprobante" icon={FileText}>
                    <div className="col-span-1 md:col-span-2">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {receiptUrls.map((url, idx) => (
                          <a key={idx} href={url} target="_blank" rel="noreferrer" className="block">
                            <img src={url} alt={`Comprobante ${idx + 1}`} className="w-full h-40 object-cover rounded-md border border-border" />
                          </a>
                        ))}
                      </div>
                    </div>
                  </DetailSection>
                </>
              )}

              {cost.cost_categories?.description && (
                <>
                  <Separator className="border-border"/>
                  <DetailSection title="Descripción de Categoría" icon={Tag}>
                    <div className="col-span-1 md:col-span-2">
                      <p className="text-muted-foreground">{cost.cost_categories.description}</p>
                    </div>
                  </DetailSection>
                </>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="details" className="mt-6">
            <div className="space-y-6">
              <DetailSection title="Información Detallada" icon={FileText}>
                {cost.service_folio && (
                  <DetailItem 
                    icon={Building} 
                    label="Folio de Servicio" 
                    value={cost.service_folio} 
                    isFullWidth={true}
                  />
                )}
                {!cost.service_folio && (
                  <div className="col-span-1 md:col-span-2 text-center py-6 text-muted-foreground">
                    <Building className="size-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay información detallada adicional</p>
                  </div>
                )}
              </DetailSection>
            </div>
          </TabsContent>

          <TabsContent value="associations" className="mt-6">
            <div className="space-y-6">
              {associatedInfo ? (
                <DetailSection title={`Asociado a ${associatedInfo.type}`} icon={associatedInfo.icon}>
                  <DetailItem 
                    icon={associatedInfo.icon} 
                    label={associatedInfo.type} 
                    value={associatedInfo.details} 
                    valueClass="text-lg text-primary" 
                    isFullWidth={true}
                  />
                  
                  {/* Información completa del servicio asociado */}
                  {cost.services && (
                    <>
                      <Separator className="border-border my-4 col-span-1 md:col-span-2"/>
                      <div className="col-span-1 md:col-span-2">
                        <h4 className="text-md font-semibold text-foreground mb-3 flex items-center">
                          <Wrench className="size-4 mr-2 text-primary"/>
                          Información del Servicio
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                          <DetailItem icon={FileText} label="Folio" value={cost.services.folio} />
                          <DetailItem icon={Users} label="Cliente" value={cost.services.clients?.name || 'Sin cliente'} />
                          <DetailItem icon={Calendar} label="Fecha de Solicitud" value={format(parseFromDatabase(cost.services.request_date), 'dd/MM/yyyy', { locale: es })} />
                          <DetailItem icon={Calendar} label="Fecha de Servicio" value={format(parseFromDatabase(cost.services.service_date), 'dd/MM/yyyy', { locale: es })} />
                          {cost.services.purchase_order && (
                            <DetailItem icon={Hash} label="Orden de Compra" value={cost.services.purchase_order} />
                          )}
                          <DetailItem icon={Tag} label="Estado" value={cost.services.status || 'Sin estado'} />
                        </div>
                      </div>

                      <div className="col-span-1 md:col-span-2">
                        <h4 className="text-md font-semibold text-foreground mb-3 flex items-center">
                          <Car className="size-4 mr-2 text-primary"/>
                          Información del Vehículo
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                          <DetailItem icon={Car} label="Marca" value={cost.services.vehicle_brand} />
                          <DetailItem icon={Car} label="Modelo" value={cost.services.vehicle_model} />
                          <DetailItem icon={Hash} label="Patente" value={cost.services.license_plate} valueClass="font-mono" />
                        </div>
                      </div>

                      <div className="col-span-1 md:col-span-2">
                        <h4 className="text-md font-semibold text-foreground mb-3 flex items-center">
                          <MapPin className="size-4 mr-2 text-primary"/>
                          Ubicación del Servicio
                        </h4>
                        <div className="grid grid-cols-1 gap-y-3">
                          <DetailItem icon={MapPin} label="Origen" value={cost.services.origin} isFullWidth={true} />
                          <DetailItem icon={Navigation} label="Destino" value={cost.services.destination} isFullWidth={true} />
                        </div>
                      </div>

                      {cost.services.observations && (
                        <div className="col-span-1 md:col-span-2">
                          <h4 className="text-md font-semibold text-foreground mb-3 flex items-center">
                            <FileText className="size-4 mr-2 text-primary"/>
                            Observaciones del Servicio
                          </h4>
                          <div className="bg-muted/50 rounded-lg p-4 border">
                            <p className="text-muted-foreground whitespace-pre-wrap">
                              {cost.services.observations}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Información de grúa si está asociada */}
                  {cost.cranes && (
                    <>
                      <Separator className="border-border my-4 col-span-1 md:col-span-2"/>
                      <div className="col-span-1 md:col-span-2">
                        <h4 className="text-md font-semibold text-foreground mb-3 flex items-center">
                          <Truck className="size-4 mr-2 text-primary"/>
                          Información de la Grúa
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                          <DetailItem icon={Truck} label="Tipo" value={cost.cranes.type} />
                          <DetailItem icon={Calendar} label="Seguro Vigencia" value={format(parseFromDatabase(cost.cranes.insurance_expiry), 'dd/MM/yyyy', { locale: es })} />
                          <DetailItem icon={Calendar} label="Revisión Técnica" value={format(parseFromDatabase(cost.cranes.technical_review_expiry), 'dd/MM/yyyy', { locale: es })} />
                          <DetailItem icon={Calendar} label="Permiso Circulación" value={format(parseFromDatabase(cost.cranes.circulation_permit_expiry), 'dd/MM/yyyy', { locale: es })} />
                        </div>
                      </div>
                    </>
                  )}
                  
                  {/* Información de operador si está asociado */}
                  {cost.operators && (
                    <>
                      <Separator className="border-border my-4 col-span-1 md:col-span-2"/>
                      <div className="col-span-1 md:col-span-2">
                        <h4 className="text-md font-semibold text-foreground mb-3 flex items-center">
                          <User className="size-4 mr-2 text-primary"/>
                          Información del Operador
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                          <DetailItem icon={Hash} label="Número de Licencia" value={cost.operators.license_number} />
                          <DetailItem icon={Calendar} label="Vencimiento Examen" value={format(parseFromDatabase(cost.operators.exam_expiry), 'dd/MM/yyyy', { locale: es })} />
                        </div>
                      </div>
                    </>
                  )}
                </DetailSection>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Building className="size-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Este costo no está asociado a ningún recurso específico</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <CostHistoryTabContent costId={cost.id} />
          </TabsContent>
        </Tabs>

        {/* Traceability Panel */}
        <Separator className="border-border" />
        <CostTraceabilityPanel costId={cost.id} />

        <div className="flex justify-between text-sm text-muted-foreground pt-4 mt-4 border-t">
          <span>
            Creado: {formatForDisplayWithTime(cost.created_at)}
            {cost.creator && ` por ${getCreatorDisplayName(cost.creator)}`}
          </span>
          <span>Actualizado: {formatForDisplayWithTime(cost.updated_at)}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
