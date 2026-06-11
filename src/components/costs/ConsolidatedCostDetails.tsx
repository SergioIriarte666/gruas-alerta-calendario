import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Cost } from '@/types/costs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar,
  DollarSign,
  FileText,
  Truck,
  User,
  Wrench,
  Building,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  Copy,
  Edit,
  MapPin,
  Car,
  StickyNote,
  History,
  Download,
  FileUp,
} from 'lucide-react';
import { parseFromDatabase, formatForDisplayWithTime } from '@/utils/timezoneUtils';
import { supabase } from '@/integrations/supabase/client';
import { useCostChangeHistory } from '@/hooks/useChangeHistory';
import { ChangeHistoryPanel } from '@/components/shared/ChangeHistoryPanel';
import { generateCostDetailPDF } from '@/utils/pdf/costDetailPdfGenerator';
import { triggerFileDownload } from '@/utils/fileDownload';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/components/ui/custom-toast';
import { createLogger } from "@/lib/logger";
import { getCostAuditDisplay } from '@/utils/costHelpers';


const logger = createLogger("ConsolidatedCostDetails");
interface ConsolidatedCostDetailsProps {
  cost: Cost;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (cost: Cost) => void;
  onDuplicate?: (cost: Cost) => void;
  onImportXml?: (cost: Cost) => void;
}

export const ConsolidatedCostDetails = ({
  cost,
  isOpen,
  onClose,
  onEdit,
  onDuplicate,
  onImportXml,
}: ConsolidatedCostDetailsProps) => {
  const [showAssociations, setShowAssociations] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const { settings } = useSettings();
  const { toast } = useToast();
  const { data: changeHistory, isLoading: historyLoading } = useCostChangeHistory(isOpen ? cost.id : null);
  const hasCreatedInfo = Boolean(cost.created_at);
  const hasUpdatedInfo = Boolean(cost.updated_at);
  const hasAuditInfo = hasCreatedInfo || hasUpdatedInfo;
  const createdHistoryEntry = changeHistory?.find((entry) => entry.changeType === 'CREATE');
  const latestUpdateEntry = changeHistory?.find((entry) => entry.changeType === 'UPDATE');
  const { creatorDisplayName, updaterDisplayName } = getCostAuditDisplay({
    creator: cost.creator,
    createdHistoryEntry,
    latestUpdateEntry,
    hasCreatedInfo,
    hasUpdatedInfo,
    wasUpdatedAfterCreation: Boolean(cost.created_at && cost.updated_at && cost.created_at !== cost.updated_at),
  });

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const hasAssociations = cost.cranes || cost.operators || cost.services;
  const hasNotes = cost.notes && cost.notes.trim().length > 0;
  const shouldLoadInvoiceDetails = Boolean((cost as any).supplier_invoice_id || (cost.service_folio && cost.supplier_id));

  const { data: supplierInvoiceDetails } = useQuery({
    queryKey: ['supplier-invoice-details', (cost as any).supplier_invoice_id || `${cost.supplier_id}-${cost.service_folio}`],
    queryFn: async () => {
      let invoiceQuery = supabase
        .from('supplier_invoices')
        .select(`
          id,
          invoice_number,
          issue_date,
          due_date,
          amount,
          net_amount,
          tax_amount,
          currency,
          status,
          source_module,
          xml_file_name,
          items:supplier_invoice_items(
            id,
            line_number,
            product_code,
            product_name,
            description,
            quantity,
            unit_price,
            subtotal,
            tax_rate,
            tax_amount,
            total_amount,
            movement_id,
            inventory_item:inventory_items(id, name, sku, barcode)
          )
        `);

      if ((cost as any).supplier_invoice_id) {
        invoiceQuery = invoiceQuery.eq('id', (cost as any).supplier_invoice_id);
      } else {
        invoiceQuery = invoiceQuery
          .eq('supplier_id', cost.supplier_id)
          .eq('invoice_number', cost.service_folio);
      }

      const { data, error } = await invoiceQuery.maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: isOpen && shouldLoadInvoiceDetails,
  });

  const invoiceItems = ((supplierInvoiceDetails as any)?.items || []) as Array<any>;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,1100px)] max-w-5xl overflow-x-hidden border-border/70 bg-card pr-10">
        <DialogHeader>
          <div className="flex flex-col gap-4 pr-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl font-bold text-foreground">
                {cost.description}
              </DialogTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                  {cost.cost_categories?.name || 'Sin categoría'}
                </Badge>
                {cost.subcategory && (
                  <Badge variant="outline">
                    {cost.subcategory}
                  </Badge>
                )}
              </div>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <p className="break-words text-2xl font-bold text-primary sm:text-3xl">
                {formatCurrency(Number(cost.amount))}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  className="gap-2"
                >
                    <Download className="size-4" />
                  {isDownloadingPdf ? 'Generando...' : 'Descargar PDF'}
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Información principal */}
          <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Calendar className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="font-medium text-foreground">
                    {format(parseFromDatabase(cost.date), "dd 'de' MMMM, yyyy", { locale: es })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-success/10 p-2">
                  <DollarSign className="size-4 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monto</p>
                  <p className="font-medium text-foreground">
                    {formatCurrency(Number(cost.amount))}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${cost.payment_date 
                  ? 'bg-success/10' 
                  : 'bg-warning/10'}`}>
                  {cost.payment_date 
                    ? <CheckCircle className="size-4 text-success" />
                    : <Clock className="size-4 text-warning" />}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha de Pago</p>
                  <p className="font-medium text-foreground">
                    {cost.payment_date 
                      ? format(new Date(cost.payment_date + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })
                      : 'Pendiente'}
                  </p>
                </div>
              </div>

              {cost.service_folio && (
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-info/10 p-2">
                    <FileText className="size-4 text-info" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Folio Servicio</p>
                    <p className="font-medium text-foreground font-mono">{cost.service_folio}</p>
                  </div>
                </div>
              )}

              {cost.cost_center_id && (
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Building className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Centro de Costo</p>
                    <p className="font-medium text-foreground">
                      {cost.cost_centers?.name || cost.cost_center_id}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Asociaciones colapsables */}
          {hasAssociations && (
            <Collapsible open={showAssociations} onOpenChange={setShowAssociations}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Wrench className="size-4 text-primary" />
                    Asociaciones
                  </span>
                  {showAssociations ? (
                    <ChevronUp className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="space-y-4 rounded-lg border border-border/70 bg-muted/20 p-4">
                  {cost.cranes && (
                    <div className="flex items-start gap-3">
                      <Truck className="mt-0.5 size-5 text-info" />
                      <div>
                        <p className="text-xs text-muted-foreground">Grúa</p>
                        <p className="font-medium text-foreground">
                          {cost.cranes.brand} {cost.cranes.model}
                        </p>
                        <p className="text-sm text-muted-foreground font-mono">
                          {cost.cranes.license_plate}
                        </p>
                      </div>
                    </div>
                  )}

                  {cost.operators && (
                    <div className="flex items-start gap-3">
                      <User className="mt-0.5 size-5 text-success" />
                      <div>
                        <p className="text-xs text-muted-foreground">Operador</p>
                        <p className="font-medium text-foreground">{cost.operators.name}</p>
                        <p className="text-sm text-muted-foreground">{cost.operators.rut}</p>
                      </div>
                    </div>
                  )}

                  {cost.services && (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Wrench className="mt-0.5 size-5 text-primary" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Servicio</p>
                          <p className="font-medium text-foreground">
                            Folio: {cost.services.folio}
                          </p>
                          {cost.services.clients && (
                            <p className="text-sm text-muted-foreground">
                              Cliente: {cost.services.clients.name}
                            </p>
                          )}
                        </div>
                      </div>

                      {(cost.services.origin || cost.services.destination) && (
                        <div className="ml-8 space-y-1">
                          {cost.services.origin && (
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="size-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Origen:</span>
                              <span className="text-foreground">{cost.services.origin}</span>
                            </div>
                          )}
                          {cost.services.destination && (
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="size-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Destino:</span>
                              <span className="text-foreground">{cost.services.destination}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {cost.services.license_plate && (
                        <div className="ml-8 flex items-center gap-2 text-sm">
                          <Car className="size-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Patente:</span>
                          <span className="text-foreground font-mono">{cost.services.license_plate}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Notas colapsables */}
          {hasNotes && (
            <Collapsible open={showNotes} onOpenChange={setShowNotes}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <StickyNote className="size-4 text-warning" />
                    Notas
                  </span>
                  {showNotes ? (
                    <ChevronUp className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="rounded-lg border border-warning/20 bg-warning/10 p-4">
                  <p className="text-foreground whitespace-pre-wrap break-words">{cost.notes}</p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {supplierInvoiceDetails && (
            <div className="space-y-3">
              <Separator />
              <div className="space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Detalle de Factura</p>
                    <p className="text-xs text-muted-foreground break-words">
                      Factura {(supplierInvoiceDetails as any).invoice_number}
                      {(supplierInvoiceDetails as any).xml_file_name ? ` · XML ${(supplierInvoiceDetails as any).xml_file_name}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      Neto {formatCurrency(Number((supplierInvoiceDetails as any).net_amount || 0))}
                    </Badge>
                    <Badge variant="outline">
                      Impuestos {formatCurrency(Number((supplierInvoiceDetails as any).tax_amount || 0))}
                    </Badge>
                    <Badge variant="default">
                      Total {formatCurrency(Number((supplierInvoiceDetails as any).amount || 0))}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha emisión</p>
                    <p className="font-medium text-foreground">
                      {format(parseFromDatabase((supplierInvoiceDetails as any).issue_date), "dd 'de' MMMM, yyyy", { locale: es })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <p className="font-medium text-foreground">
                      {(supplierInvoiceDetails as any).status || 'pending'}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="min-w-[760px] w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr className="text-left">
                        <th className="px-3 py-2">Codigo</th>
                        <th className="px-3 py-2">Descripcion</th>
                        <th className="px-3 py-2">Cantidad</th>
                        <th className="px-3 py-2">Unitario</th>
                        <th className="px-3 py-2">Subtotal</th>
                        <th className="px-3 py-2">Impuestos</th>
                        <th className="px-3 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceItems.map((item) => (
                        <tr key={item.id} className="border-t border-border align-top">
                          <td className="px-3 py-2 whitespace-nowrap">
                            {item.product_code || item.inventory_item?.sku || item.inventory_item?.barcode || '-'}
                          </td>
                          <td className="px-3 py-2 min-w-[220px]">
                            <div className="font-medium text-foreground">{item.description}</div>
                            {item.inventory_item?.name && item.inventory_item.name !== item.description && (
                              <div className="text-xs text-muted-foreground">
                                Catalogo: {item.inventory_item.name}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{item.quantity}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatCurrency(Number(item.unit_price || 0))}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatCurrency(Number(item.subtotal || 0))}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatCurrency(Number(item.tax_amount || 0))}</td>
                          <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                            {formatCurrency(Number(item.total_amount || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Historial de cambios colapsable */}
          <Separator />
          <Collapsible open={showHistory} onOpenChange={setShowHistory}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <History className="size-4 text-primary" />
                  Historial de cambios
                  {changeHistory && changeHistory.length > 0 && (
                    <Badge variant="outline" className="ml-1">{changeHistory.length}</Badge>
                  )}
                </span>
                {showHistory ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <ChangeHistoryPanel changes={changeHistory || []} isLoading={historyLoading} />
            </CollapsibleContent>
          </Collapsible>

          <div className="flex gap-2 pt-2">
            {onEdit && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  onEdit(cost);
                  onClose();
                }}
              >
                <Edit className="size-4 mr-2" />
                Editar
              </Button>
            )}
            {onImportXml && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onImportXml(cost)}
              >
                <FileUp className="size-4 mr-2" />
                Actualizar con XML
              </Button>
            )}
            {onDuplicate && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  onDuplicate(cost);
                  onClose();
                }}
              >
                <Copy className="size-4 mr-2" />
                Duplicar
              </Button>
            )}
          </div>

          {/* Footer con auditoría */}
          {hasAuditInfo && (
            <>
              <Separator />
              <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2 sm:gap-3">
                <span>
                  {hasCreatedInfo ? `Creado: ${formatForDisplayWithTime(cost.created_at!)}` : ''}
                </span>
                <span>
                  {creatorDisplayName ? `Creado por: ${creatorDisplayName}` : ''}
                </span>
                <span className="sm:col-span-2">
                  {hasUpdatedInfo ? `Actualizado: ${formatForDisplayWithTime(cost.updated_at!)}` : ''}
                </span>
                <span className="sm:col-span-2">
                  {updaterDisplayName ? `Ultima actualizacion por: ${updaterDisplayName}` : ''}
                </span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
