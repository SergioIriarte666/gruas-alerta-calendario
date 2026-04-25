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
} from 'lucide-react';
import { parseFromDatabase, formatForDisplayWithTime } from '@/utils/timezoneUtils';
import { getCreatorDisplayName } from '@/types/common';
import { supabase } from '@/integrations/supabase/client';
import { useCostChangeHistory } from '@/hooks/useChangeHistory';
import { ChangeHistoryPanel } from '@/components/shared/ChangeHistoryPanel';

interface ConsolidatedCostDetailsProps {
  cost: Cost;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (cost: Cost) => void;
  onDuplicate?: (cost: Cost) => void;
}

export const ConsolidatedCostDetails = ({
  cost,
  isOpen,
  onClose,
  onEdit,
  onDuplicate,
}: ConsolidatedCostDetailsProps) => {
  const [showAssociations, setShowAssociations] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const { data: changeHistory, isLoading: historyLoading } = useCostChangeHistory(isOpen ? cost.id : null);

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
      <DialogContent className="w-[min(96vw,1100px)] max-w-5xl max-h-[92vh] overflow-y-auto overflow-x-hidden pr-10">
        <DialogHeader>
          <div className="flex flex-col gap-4 pr-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl font-bold text-foreground">
                {cost.description}
              </DialogTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
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
              <p className="break-words text-2xl font-bold text-violet-600 sm:text-3xl">
                {formatCurrency(Number(cost.amount))}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Información principal */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3">
                <div className="bg-violet-100 dark:bg-violet-900/30 p-2 rounded-lg">
                  <Calendar className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="font-medium text-foreground">
                    {format(parseFromDatabase(cost.date), "dd 'de' MMMM, yyyy", { locale: es })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                  <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
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
                  ? 'bg-green-100 dark:bg-green-900/30' 
                  : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                  {cost.payment_date 
                    ? <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    : <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />}
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
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Folio Servicio</p>
                    <p className="font-medium text-foreground font-mono">{cost.service_folio}</p>
                  </div>
                </div>
              )}

              {cost.cost_center_id && (
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
                    <Building className="w-4 h-4 text-purple-600 dark:text-purple-400" />
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
                    <Wrench className="w-4 h-4 text-violet-600" />
                    Asociaciones
                  </span>
                  {showAssociations ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="bg-muted/30 rounded-lg p-4 space-y-4">
                  {cost.cranes && (
                    <div className="flex items-start gap-3">
                      <Truck className="w-5 h-5 text-blue-600 mt-0.5" />
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
                      <User className="w-5 h-5 text-green-600 mt-0.5" />
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
                        <Wrench className="w-5 h-5 text-purple-600 mt-0.5" />
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
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Origen:</span>
                              <span className="text-foreground">{cost.services.origin}</span>
                            </div>
                          )}
                          {cost.services.destination && (
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Destino:</span>
                              <span className="text-foreground">{cost.services.destination}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {cost.services.license_plate && (
                        <div className="ml-8 flex items-center gap-2 text-sm">
                          <Car className="w-3 h-3 text-muted-foreground" />
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
                    <StickyNote className="w-4 h-4 text-amber-600" />
                    Notas
                  </span>
                  {showNotes ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
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

          {/* Acciones */}
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
                <Edit className="w-4 h-4 mr-2" />
                Editar
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
                <Copy className="w-4 h-4 mr-2" />
                Duplicar
              </Button>
            )}
          </div>

          {/* Footer con auditoría */}
          <Separator />
          <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:justify-between">
            <span>
              Creado: {formatForDisplayWithTime(cost.created_at)}
              {cost.creator && ` por ${getCreatorDisplayName(cost.creator)}`}
            </span>
            <span>Actualizado: {formatForDisplayWithTime(cost.updated_at)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
