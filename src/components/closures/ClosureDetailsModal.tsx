import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';
import { ServiceClosure } from '@/types';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  FileText,
  Calendar,
  User,
  DollarSign,
  Package,
  Wrench,
  Hash,
  Clock,
  Car,
  Receipt
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatForDisplayWithTime, formatForDisplay } from '@/utils/timezoneUtils';
import { supabase } from '@/integrations/supabase/client';

interface ClosureDetailsModalProps {
  closure: ServiceClosure | null;
  clientName?: string;
  isOpen: boolean;
  onClose: () => void;
}

interface DetailItemProps {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  isFullWidth?: boolean;
}

const DetailItem = ({ icon: Icon, label, value, valueClass = '', isFullWidth = false }: DetailItemProps) => (
  <div className={`flex items-start space-x-3 ${isFullWidth ? 'col-span-1 md:col-span-2' : ''}`}>
    <Icon className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
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
      <Icon className="w-5 h-5 mr-2 text-primary" />
      {title}
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
      {children}
    </div>
  </div>
);

const formatSafeDate = (dateValue: any): string => {
  if (!dateValue) return 'Sin fecha';
  try {
    const date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
    if (!isValid(date)) return 'Fecha inválida';
    return format(date, 'dd/MM/yyyy', { locale: es });
  } catch {
    return 'Error';
  }
};

const getStatusConfig = (status: string) => {
  const configs: Record<string, { label: string; className: string }> = {
    open: { label: 'Abierto', className: 'bg-secondary text-secondary-foreground' },
    closed: { label: 'Cerrado', className: 'bg-muted text-foreground' },
    invoiced: { label: 'Facturado', className: 'bg-primary text-primary-foreground' },
    quoted: { label: 'Cotizado', className: 'bg-secondary text-secondary-foreground' },
    purchase_order_pending: { label: 'OC Pendiente', className: 'bg-muted text-foreground' },
  };
  return configs[status] || { label: status, className: 'bg-muted text-foreground' };
};

interface ServiceRow {
  id: string;
  folio: string;
  service_date: string;
  status: string;
  value: number;
  license_plate: string;
  vehicle_brand: string;
  vehicle_model: string;
  origin: string;
  destination: string;
}

interface InvoiceRow {
  id: string;
  folio: string;
  numero_fiscal: string | null;
  issue_date: string;
  due_date: string;
  total: number;
  status: string;
  paid_amount: number;
}

interface ClientRow {
  id: string;
  name: string;
  rut: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export const ClosureDetailsModal = ({ closure, clientName, isOpen, onClose }: ClosureDetailsModalProps) => {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [client, setClient] = useState<ClientRow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!closure || !isOpen) return;

    setLoading(true);

    const fetchData = async () => {
      // Fetch services
      if (closure.serviceIds.length > 0) {
        const { data: svcData } = await supabase
          .from('services')
          .select('id, folio, service_date, status, value, license_plate, vehicle_brand, vehicle_model, origin, destination')
          .in('id', closure.serviceIds);
        setServices((svcData as ServiceRow[]) || []);
      } else {
        setServices([]);
      }

      // Fetch invoices linked to this closure
      const { data: invoiceClosures } = await supabase
        .from('invoice_closures')
        .select('invoice_id')
        .eq('closure_id', closure.id);

      const invoiceIds = (invoiceClosures || []).map((ic: any) => ic.invoice_id);
      if (invoiceIds.length > 0) {
        const { data: invData } = await supabase
          .from('invoices')
          .select('id, folio, numero_fiscal, issue_date, due_date, total, status, paid_amount')
          .in('id', invoiceIds);
        setInvoices((invData as InvoiceRow[]) || []);
      } else {
        setInvoices([]);
      }

      // Fetch client details
      if (closure.clientId) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('id, name, rut, email, phone, address')
          .eq('id', closure.clientId)
          .single();
        setClient(clientData as ClientRow | null);
      } else {
        setClient(null);
      }

      setLoading(false);
    };

    fetchData();
  }, [closure, isOpen]);

  if (!closure) return null;

  const statusConfig = getStatusConfig(closure.status);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Cierre {closure.folio}
            </span>
            <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="services">Servicios</TabsTrigger>
            <TabsTrigger value="invoices">Facturas</TabsTrigger>
          </TabsList>

          {/* Tab 1: General */}
          <TabsContent value="general" className="mt-6">
            <div className="space-y-6">
              <DetailSection title="Identificación" icon={Package}>
                <DetailItem icon={Package} label="Folio" value={closure.folio} />
                <DetailItem icon={Hash} label="Servicios Incluidos" value={`${closure.serviceIds.length} servicio${closure.serviceIds.length !== 1 ? 's' : ''}`} />
              </DetailSection>

              <Separator className="border-border" />

              <DetailSection title="Cliente" icon={User}>
                <DetailItem icon={User} label="Nombre" value={client?.name || clientName || 'N/A'} />
                <DetailItem icon={Hash} label="RUT" value={client?.rut} />
                {client?.email && <DetailItem icon={FileText} label="Email" value={client.email} />}
                {client?.phone && <DetailItem icon={FileText} label="Teléfono" value={client.phone} />}
                {client?.address && <DetailItem icon={FileText} label="Dirección" value={client.address} isFullWidth />}
              </DetailSection>

              <Separator className="border-border" />

              <DetailSection title="Período y Fechas" icon={Calendar}>
                <DetailItem icon={Calendar} label="Desde" value={formatForDisplay(closure.dateRange.from)} />
                <DetailItem icon={Calendar} label="Hasta" value={formatForDisplay(closure.dateRange.to)} />
              </DetailSection>

              <Separator className="border-border" />

              <DetailSection title="Información Financiera" icon={DollarSign}>
                <DetailItem
                  icon={DollarSign}
                  label="Total del Cierre"
                  value={formatCurrency(closure.total)}
                  valueClass="text-lg font-bold"
                />
                {closure.purchaseOrder && (
                  <DetailItem icon={FileText} label="Orden de Compra" value={closure.purchaseOrder} />
                )}
              </DetailSection>
            </div>
          </TabsContent>

          {/* Tab 2: Servicios */}
          <TabsContent value="services" className="mt-6">
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center">
                <Wrench className="w-5 h-5 mr-2 text-primary" />
                Servicios del Cierre
                {services.length > 0 && (
                  <Badge variant="outline" className="ml-2 text-xs">{services.length}</Badge>
                )}
              </h3>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
                  <p className="text-sm">Cargando servicios...</p>
                </div>
              ) : services.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wrench className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay servicios en este cierre</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Folio</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Fecha</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Vehículo</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Patente</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Origen → Destino</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Valor</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((s) => (
                        <tr key={s.id} className="border-b border-border hover:bg-muted/50">
                          <td className="py-2 px-3 text-foreground font-medium">{s.folio}</td>
                          <td className="py-2 px-3 text-foreground">{formatSafeDate(s.service_date)}</td>
                          <td className="py-2 px-3 text-foreground">
                            {s.vehicle_brand && s.vehicle_model ? `${s.vehicle_brand} ${s.vehicle_model}` : 'N/A'}
                          </td>
                          <td className="py-2 px-3 text-foreground font-mono text-xs">{s.license_plate || 'N/A'}</td>
                          <td className="py-2 px-3 text-foreground text-xs">
                            {s.origin || 'N/A'} → {s.destination || 'N/A'}
                          </td>
                          <td className="py-2 px-3 text-foreground">{formatCurrency(s.value)}</td>
                          <td className="py-2 px-3">
                            <Badge variant="outline" className="text-xs">{s.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab 3: Facturas */}
          <TabsContent value="invoices" className="mt-6">
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center">
                <Receipt className="w-5 h-5 mr-2 text-primary" />
                Facturas Asociadas
                {invoices.length > 0 && (
                  <Badge variant="outline" className="ml-2 text-xs">{invoices.length}</Badge>
                )}
              </h3>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
                  <p className="text-sm">Cargando facturas...</p>
                </div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay facturas asociadas a este cierre</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Folio</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">N° Fiscal</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Emisión</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Vencimiento</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Total</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Pagado</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => {
                        const invStatusConfig = getStatusConfig(inv.status === 'paid' ? 'invoiced' : inv.status);
                        return (
                          <tr key={inv.id} className="border-b border-border hover:bg-muted/50">
                            <td className="py-2 px-3 text-foreground font-medium">{inv.folio}</td>
                            <td className="py-2 px-3">
                              {inv.numero_fiscal
                                ? <span className="text-violet-600 font-medium">{inv.numero_fiscal}</span>
                                : <span className="text-muted-foreground italic">Sin asignar</span>
                              }
                            </td>
                            <td className="py-2 px-3 text-foreground">{formatSafeDate(inv.issue_date)}</td>
                            <td className="py-2 px-3 text-foreground">{formatSafeDate(inv.due_date)}</td>
                            <td className="py-2 px-3 text-foreground font-medium">{formatCurrency(inv.total)}</td>
                            <td className="py-2 px-3 text-foreground">{formatCurrency(inv.paid_amount || 0)}</td>
                            <td className="py-2 px-3">
                              <Badge variant="outline" className="text-xs">{inv.status}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex flex-col sm:flex-row justify-between text-sm text-muted-foreground pt-4 mt-4 border-t gap-1">
          <span className="truncate">
            Creado: {formatForDisplayWithTime(closure.createdAt)}
            {closure.creatorName && ` por ${closure.creatorName}`}
          </span>
          <span className="truncate">Actualizado: {formatForDisplayWithTime(closure.updatedAt)}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
