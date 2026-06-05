import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Invoice } from '@/types';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { isValid, parseISO, differenceInDays } from 'date-fns';
import { formatForDisplay, formatForDisplayWithTime } from '@/utils/timezoneUtils';
import {
  FileText,
  Calendar,
  User,
  DollarSign,
  Hash,
  Phone,
  Mail,
  CreditCard,
  Clock,
  CheckCircle,
  AlertTriangle,
  Receipt,
  Wrench,
  Package,
  Printer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

interface InvoiceDetailsModalProps {
  invoice: Invoice | null;
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
  <div className={`flex items-start gap-x-3 ${isFullWidth ? 'col-span-1 md:col-span-2' : ''}`}>
    <Icon className="size-4 text-muted-foreground mt-1 flex-shrink-0" />
    <div className="flex-grow">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`font-medium text-foreground ${valueClass}`}>{value || 'N/A'}</p>
    </div>
  </div>
);

type SectionColor = 'primary' | 'success' | 'warning' | 'info' | 'danger';

const sectionColorConfig: Record<SectionColor, { border: string; bg: string; iconBg: string; title: string }> = {
  primary: { border: 'border-l-primary', bg: 'bg-primary/5', iconBg: 'bg-primary/10 text-primary', title: 'text-primary' },
  success: { border: 'border-l-success', bg: 'bg-success/5', iconBg: 'bg-success/10 text-success', title: 'text-success' },
  warning: { border: 'border-l-warning', bg: 'bg-warning/5', iconBg: 'bg-warning/10 text-warning', title: 'text-warning' },
  info: { border: 'border-l-info', bg: 'bg-info/5', iconBg: 'bg-info/10 text-info', title: 'text-info' },
  danger: { border: 'border-l-danger', bg: 'bg-danger/5', iconBg: 'bg-danger/10 text-danger', title: 'text-danger' },
};

interface DetailSectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  color?: SectionColor;
}

const DetailSection = ({ title, icon: Icon, children, color = 'primary' }: DetailSectionProps) => {
  const config = sectionColorConfig[color];
  return (
    <div className={`rounded-lg border border-border border-l-4 ${config.border} ${config.bg} p-4`}>
      <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${config.title}`}>
        <div className={`p-1 rounded ${config.iconBg}`}>
          <Icon className="size-4" />
        </div>
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {children}
      </div>
    </div>
  );
};

const formatSafeDate = (dateValue: any): string => {
  if (!dateValue) return 'Sin fecha';
  try {
    const date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
    if (!isValid(date)) return 'Fecha inválida';
    return formatForDisplay(date);
  } catch {
    return 'Error';
  }
};

const getStatusConfig = (status: string) => {
  const configs: Record<string, { label: string; className: string }> = {
    draft: { label: 'Borrador', className: 'bg-muted text-foreground' },
    sent: { label: 'Enviada', className: 'bg-secondary text-secondary-foreground' },
    paid: { label: 'Pagada', className: 'bg-primary text-primary-foreground' },
    overdue: { label: 'Vencida', className: 'bg-destructive text-destructive-foreground' },
    cancelled: { label: 'Anulada', className: 'bg-muted text-muted-foreground' },
  };
  return configs[status] || configs.draft;
};

interface PaymentApplicationRow {
  id: string;
  applied_amount: number;
  application_method: string;
  created_at: string;
  payment: {
    id: string;
    bank_reference: string | null;
    payment_method: string;
    payment_date: string;
  } | null;
}

interface ServiceRow {
  id: string;
  folio: string;
  service_date: string;
  status: string;
  value: number;
  license_plate: string;
  vehicle_brand: string;
  vehicle_model: string;
}

interface ClosureRow {
  id: string;
  folio: string;
  status: string;
  total: number;
  created_at: string;
}

export const InvoiceDetailsModal = ({ invoice, isOpen, onClose }: InvoiceDetailsModalProps) => {
  const [paymentTermName, setPaymentTermName] = useState<string | null>(null);
  const [paymentApplications, setPaymentApplications] = useState<PaymentApplicationRow[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [closures, setClosures] = useState<ClosureRow[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [cancellation, setCancellation] = useState<{
    credit_note_number: string;
    cancellation_reason: string;
    reason_details: string | null;
    cancelled_at: string;
  } | null>(null);

  useEffect(() => {
    if (!invoice || !isOpen) return;

    if (invoice.paymentTermId) {
      supabase
        .from('payment_terms')
        .select('name')
        .eq('id', invoice.paymentTermId)
        .single()
        .then(({ data }) => {
          setPaymentTermName(data?.name || null);
        });
    } else {
      setPaymentTermName(null);
    }

    // Cargar datos de anulación si la factura está anulada
    if (invoice.status === 'cancelled') {
      supabase
        .from('invoice_cancellations')
        .select('credit_note_number, cancellation_reason, reason_details, cancelled_at')
        .eq('invoice_id', invoice.id)
        .maybeSingle()
        .then(({ data }) => setCancellation(data || null));
    } else {
      setCancellation(null);
    }

    setLoadingPayments(true);
    supabase
      .from('payment_applications')
      .select(`
        id,
        applied_amount,
        application_method,
        created_at,
        payment:payments (
          id,
          bank_reference,
          payment_method,
          payment_date
        )
      `)
      .eq('invoice_id', invoice.id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setPaymentApplications(data as any);
        }
        setLoadingPayments(false);
      });

    setLoadingServices(true);
    Promise.all([
      supabase
        .from('invoice_services')
        .select('service_id')
        .eq('invoice_id', invoice.id),
      supabase
        .from('invoice_closures')
        .select('closure_id')
        .eq('invoice_id', invoice.id),
    ]).then(async ([servicesRes, closuresRes]) => {
      const serviceIds = (servicesRes.data || []).map((s: any) => s.service_id);
      if (serviceIds.length > 0) {
        const { data } = await supabase
          .from('services')
          .select('id, folio, service_date, status, value, license_plate, vehicle_brand, vehicle_model')
          .in('id', serviceIds);
        setServices((data as ServiceRow[]) || []);
      } else {
        setServices([]);
      }

      const closureIds = (closuresRes.data || []).map((c: any) => c.closure_id);
      if (closureIds.length > 0) {
        const { data } = await supabase
          .from('service_closures')
          .select('id, folio, status, total, created_at')
          .in('id', closureIds);
        setClosures((data as ClosureRow[]) || []);
      } else {
        setClosures([]);
      }

      setLoadingServices(false);
    });
  }, [invoice, isOpen]);

  if (!invoice) return null;

  const isCancelled = invoice.status === 'cancelled';
  const rawPaidAmount = invoice.paidAmount ?? 0;
  // En facturas anuladas el monto se neutraliza con NC, no se considera "pagado"
  const paidAmount = isCancelled
    ? 0
    : (invoice.status === 'paid' && rawPaidAmount <= 0 ? invoice.total : rawPaidAmount);
  const pendingAmount = isCancelled
    ? 0
    : (invoice.status === 'paid'
      ? 0
      : (invoice.remainingAmount != null ? invoice.remainingAmount : Math.max(invoice.total - paidAmount, 0)));
  const paymentPercentage = isCancelled
    ? 0
    : (invoice.total > 0 ? Math.min(100, Math.round((paidAmount / invoice.total) * 100)) : 0);
  const statusConfig = getStatusConfig(invoice.status);

  const cancellationReasonLabels: Record<string, string> = {
    error_datos_cliente: 'Error en datos del cliente',
    error_montos: 'Error en montos facturados',
    servicio_no_prestado: 'Servicio no prestado',
    duplicado: 'Duplicado de factura',
    solicitud_cliente: 'Solicitud del cliente',
    otro: 'Otro',
  };

  const methodLabels: Record<string, string> = {
    fifo: 'Automático (legado)',
    manual: 'Manual',
    proportional: 'Proporcional',
    transfer: 'Transferencia',
    cash: 'Efectivo',
    check: 'Cheque',
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="size-5" />
              Factura {invoice.folio}
              {invoice.numeroFiscal && (
                <span className="text-muted-foreground font-normal text-sm">| N° {invoice.numeroFiscal}</span>
              )}
            </span>
            <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="financial">Financiera</TabsTrigger>
            <TabsTrigger value="payments">Pagos</TabsTrigger>
            <TabsTrigger value="services">Servicios</TabsTrigger>
          </TabsList>

          {/* Tab 1: General */}
          <TabsContent value="general" className="mt-6">
            <div className="space-y-4">
              {isCancelled && (
                <div className="rounded-lg border border-border border-l-4 border-l-danger bg-danger/5 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-danger">
                    <div className="rounded bg-danger/10 p-1 text-danger">
                      <AlertTriangle className="size-4" />
                    </div>
                    Factura Anulada
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                    <DetailItem
                      icon={Hash}
                      label="Nota de Crédito"
                      value={cancellation?.credit_note_number
                        ? <span className="font-semibold text-danger">NC {cancellation.credit_note_number}</span>
                        : <span className="text-muted-foreground italic">Sin registro</span>}
                    />
                    <DetailItem
                      icon={Calendar}
                      label="Fecha de Anulación"
                      value={cancellation?.cancelled_at ? formatSafeDate(cancellation.cancelled_at) : 'N/A'}
                    />
                    <DetailItem
                      icon={FileText}
                      label="Motivo"
                      value={cancellation?.cancellation_reason
                        ? (cancellationReasonLabels[cancellation.cancellation_reason] || cancellation.cancellation_reason)
                        : 'N/A'}
                      isFullWidth={!cancellation?.reason_details}
                    />
                    {cancellation?.reason_details && (
                      <DetailItem
                        icon={FileText}
                        label="Detalle"
                        value={cancellation.reason_details}
                        isFullWidth
                      />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-3 italic">
                    Esta factura fue anulada mediante Nota de Crédito y no genera deuda. Los servicios fueron liberados para re-facturación.
                  </p>
                </div>
              )}

              <DetailSection title="Identificación" icon={FileText} color="primary">
                <DetailItem icon={FileText} label="Folio" value={invoice.folio} />
                <DetailItem
                  icon={Hash}
                  label="Número Fiscal"
                  value={
                    invoice.numeroFiscal
                      ? <span className="text-primary">{invoice.numeroFiscal}</span>
                      : <span className="text-muted-foreground italic">Sin asignar</span>
                  }
                />
              </DetailSection>

              <DetailSection title="Cliente" icon={User} color="success">
                <DetailItem icon={User} label="Nombre" value={invoice.client?.name ? toTitleCase(invoice.client.name) : undefined} />
                <DetailItem icon={Hash} label="RUT" value={invoice.client?.rut} />
                {invoice.client?.email && (
                  <DetailItem icon={Mail} label="Email" value={invoice.client.email} />
                )}
                {invoice.client?.phone && (
                  <DetailItem icon={Phone} label="Teléfono" value={invoice.client.phone} />
                )}
              </DetailSection>

              <DetailSection title="Fechas" icon={Calendar} color="warning">
                <DetailItem icon={Calendar} label="Fecha de Emisión" value={formatSafeDate(invoice.issueDate)} />
                <DetailItem icon={Calendar} label="Fecha de Vencimiento" value={formatSafeDate(invoice.dueDate)} />
                {paymentTermName && (
                  <DetailItem icon={Clock} label="Condición de Pago" value={paymentTermName} />
                )}
                {invoice.issueDate && (() => {
                  try {
                    const issued = typeof invoice.issueDate === 'string' ? parseISO(invoice.issueDate) : new Date(invoice.issueDate);
                    if (!isValid(issued)) return null;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    issued.setHours(0, 0, 0, 0);
                    const daysSinceIssue = differenceInDays(today, issued);
                    return (
                      <DetailItem
                        icon={Clock}
                        label="Días desde Emisión"
                        value={
                          <Badge variant="outline" className="text-xs font-medium">
                            {daysSinceIssue} día{daysSinceIssue !== 1 ? 's' : ''}
                          </Badge>
                        }
                      />
                    );
                  } catch { return null; }
                })()}
                {invoice.dueDate && invoice.status !== 'paid' && !isCancelled && (() => {
                  try {
                    const due = typeof invoice.dueDate === 'string' ? parseISO(invoice.dueDate) : new Date(invoice.dueDate);
                    if (!isValid(due)) return null;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    due.setHours(0, 0, 0, 0);
                    const daysUntilDue = differenceInDays(due, today);
                    const isOverdue = daysUntilDue < 0;
                    return (
                      <DetailItem
                        icon={AlertTriangle}
                        label={isOverdue ? 'Días de Atraso' : 'Días para Vencer'}
                        value={
                            <Badge className={`text-xs font-medium ${isOverdue ? 'bg-destructive text-destructive-foreground' : daysUntilDue <= 7 ? 'bg-warning text-warning-foreground' : 'bg-primary text-primary-foreground'}`}>
                            {isOverdue ? `${Math.abs(daysUntilDue)} día${Math.abs(daysUntilDue) !== 1 ? 's' : ''} vencida` : `${daysUntilDue} día${daysUntilDue !== 1 ? 's' : ''}`}
                          </Badge>
                        }
                      />
                    );
                  } catch { return null; }
                })()}
              </DetailSection>

              {invoice.notes && (
              <DetailSection title="Notas" icon={FileText} color="info">
                  <div className="col-span-1 md:col-span-2">
                    <p className="text-muted-foreground whitespace-pre-wrap min-h-[40px]">
                      {invoice.notes}
                    </p>
                  </div>
                </DetailSection>
              )}
            </div>
          </TabsContent>

          {/* Tab 2: Financiera */}
          <TabsContent value="financial" className="mt-6">
            <div className="space-y-4">
              {isCancelled && (
                <div className="flex items-start gap-2 rounded-lg border border-border border-l-4 border-l-danger bg-danger/5 p-3 text-sm text-danger">
                  <AlertTriangle className="size-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Factura anulada{cancellation?.credit_note_number ? ` con NC ${cancellation.credit_note_number}` : ''}. El monto fue neutralizado y no representa deuda ni ingreso pagado.
                  </span>
                </div>
              )}

              <DetailSection title="Desglose" icon={DollarSign} color="primary">
                <DetailItem icon={DollarSign} label="Subtotal" value={formatCurrency(invoice.subtotal)} />
                <DetailItem icon={DollarSign} label="IVA" value={formatCurrency(invoice.vat)} />
                <DetailItem
                  icon={DollarSign}
                  label="Total"
                  value={formatCurrency(invoice.total)}
                  valueClass="text-lg font-bold"
                />
                {!isCancelled && (
                  <DetailItem
                    icon={CheckCircle}
                    label="Monto Pagado"
                    value={formatCurrency(paidAmount)}
                    valueClass="text-success"
                  />
                )}
                {!isCancelled && (
                  <DetailItem
                    icon={AlertTriangle}
                    label="Monto Pendiente"
                    value={formatCurrency(pendingAmount)}
                    valueClass={pendingAmount > 0 ? 'text-warning' : 'text-success'}
                  />
                )}
                {isCancelled && (
                  <DetailItem
                    icon={AlertTriangle}
                    label="Estado Financiero"
                    value={<span className="font-semibold text-danger">Anulada con NC</span>}
                    isFullWidth
                  />
                )}
                {invoice.paymentDate && !isCancelled && (
                  <DetailItem icon={Calendar} label="Fecha de Pago" value={formatSafeDate(invoice.paymentDate)} />
                )}
              </DetailSection>

              {!isCancelled && (
                <div className={`rounded-lg border border-border border-l-4 ${sectionColorConfig.success.border} ${sectionColorConfig.success.bg} p-4`}>
                  <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${sectionColorConfig.success.title}`}>
                    <div className={`p-1 rounded ${sectionColorConfig.success.iconBg}`}>
                      <CreditCard className="size-4" />
                    </div>
                    Progreso de Pago
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {formatCurrency(paidAmount)} de {formatCurrency(invoice.total)}
                      </span>
                      <span className="font-medium text-foreground">{paymentPercentage}%</span>
                    </div>
                    <Progress value={paymentPercentage} className="h-3" />
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab 3: Pagos Aplicados */}
          <TabsContent value="payments" className="mt-6">
            <div className={`rounded-lg border border-border border-l-4 ${sectionColorConfig.info.border} ${sectionColorConfig.info.bg} p-4`}>
              <h3 className={`mb-4 flex items-center gap-2 text-lg font-semibold ${sectionColorConfig.info.title}`}>
                <div className={`rounded p-1 ${sectionColorConfig.info.iconBg}`}>
                  <Receipt className="size-4" />
                </div>
                Historial de Pagos Aplicados
              </h3>

              {loadingPayments ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="size-8 mx-auto mb-2 animate-spin opacity-50" />
                  <p className="text-sm">Cargando pagos...</p>
                </div>
              ) : paymentApplications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="size-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay pagos aplicados a esta factura</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Fecha</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Monto</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Método</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Referencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentApplications.map((pa) => (
                        <tr key={pa.id} className="border-b border-border hover:bg-muted/50">
                          <td className="py-2 px-3 text-foreground">
                            {formatSafeDate(pa.payment?.payment_date || pa.created_at)}
                          </td>
                          <td className="py-2 px-3 font-medium text-success">
                            {formatCurrency(pa.applied_amount)}
                          </td>
                          <td className="py-2 px-3 text-foreground">
                            {methodLabels[pa.application_method] || pa.application_method}
                            {pa.payment?.payment_method && (
                              <span className="text-muted-foreground ml-1">
                                ({methodLabels[pa.payment.payment_method] || pa.payment.payment_method})
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">
                            {pa.payment?.bank_reference || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab 4: Servicios y Cierres */}
          <TabsContent value="services" className="mt-6">
            <div className="space-y-4">
              <div className={`rounded-lg border border-border border-l-4 ${sectionColorConfig.warning.border} ${sectionColorConfig.warning.bg} p-4`}>
                <h3 className={`mb-4 flex items-center gap-2 text-lg font-semibold ${sectionColorConfig.warning.title}`}>
                  <div className={`rounded p-1 ${sectionColorConfig.warning.iconBg}`}>
                    <Package className="size-4" />
                  </div>
                  Cierres Asociados
                </h3>
                {loadingServices ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <Clock className="size-6 mx-auto mb-2 animate-spin opacity-50" />
                    <p className="text-sm">Cargando...</p>
                  </div>
                ) : closures.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <Package className="size-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay cierres asociados</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Folio</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Estado</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Total</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {closures.map((c) => (
                          <tr key={c.id} className="border-b border-border hover:bg-muted/50">
                            <td className="py-2 px-3 text-foreground font-medium">{c.folio}</td>
                            <td className="py-2 px-3">
                              <Badge variant="outline" className="text-xs">{c.status}</Badge>
                            </td>
                            <td className="py-2 px-3 text-foreground">{formatCurrency(c.total)}</td>
                            <td className="py-2 px-3 text-muted-foreground">{formatSafeDate(c.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className={`rounded-lg border border-border border-l-4 ${sectionColorConfig.info.border} ${sectionColorConfig.info.bg} p-4`}>
                <h3 className={`mb-4 flex items-center gap-2 text-lg font-semibold ${sectionColorConfig.info.title}`}>
                  <div className={`rounded p-1 ${sectionColorConfig.info.iconBg}`}>
                    <Wrench className="size-4" />
                  </div>
                  Servicios Incluidos
                  {services.length > 0 && (
                    <Badge variant="outline" className="ml-2 text-xs">{services.length}</Badge>
                  )}
                  {services.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto h-7 text-xs"
                      onClick={() => {
                        const printWindow = window.open('', '_blank');
                        if (!printWindow) return;
                        const esc = (v: unknown) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
                        const totalServicios = services.reduce((sum, s) => sum + (s.value || 0), 0);
                        const rows = services.map(s => `
                           <tr>
                             <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${esc(s.folio || 'N/A')}</td>
                             <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${esc(formatSafeDate(s.service_date))}</td>
                             <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${s.vehicle_brand && s.vehicle_model ? `${esc(s.vehicle_brand)} ${esc(s.vehicle_model)}` : 'N/A'}</td>
                             <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${esc(s.license_plate || 'N/A')}</td>
                             <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${esc(formatCurrency(s.value))}</td>
                             <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${esc(s.status || 'N/A')}</td>
                           </tr>
                         `).join('');
                         printWindow.document.write(`
                           <html><head><title>Servicios - Factura ${esc(invoice.folio)}</title>
                           <style>
                             body{font-family:Arial,sans-serif;margin:30px;color:#1a1a1a}
                             h2{margin:0 0 4px}
                             .meta{color:#666;font-size:13px;margin-bottom:16px}
                             table{width:100%;border-collapse:collapse;font-size:13px}
                             th{text-align:left;padding:8px 10px;border-bottom:2px solid #333;font-weight:600}
                             .total-row td{font-weight:700;border-top:2px solid #333;padding-top:10px}
                             @media print{body{margin:15px}}
                           </style></head><body>
                           <h2>Factura ${esc(invoice.folio)}${invoice.numeroFiscal ? ` | N° Fiscal: ${esc(invoice.numeroFiscal)}` : ''}</h2>
                           <div class="meta">
                             Cliente: ${esc(invoice.client?.name || 'N/A')} &nbsp;|&nbsp; 
                             Fecha: ${esc(formatSafeDate(invoice.issueDate))} &nbsp;|&nbsp;
                             Servicios: ${services.length}
                           </div>
                           <table>
                             <thead><tr>
                               <th>Folio</th><th>Fecha</th><th>Vehículo</th><th>Patente</th><th style="text-align:right">Valor</th><th>Estado</th>
                             </tr></thead>
                             <tbody>${rows}
                               <tr class="total-row"><td colspan="4" style="text-align:right;padding:10px">Total</td><td style="text-align:right;padding:10px">${esc(formatCurrency(totalServicios))}</td><td></td></tr>
                             </tbody>
                           </table>
                           </body></html>
                         `);
                        printWindow.document.close();
                        printWindow.print();
                      }}
                    >
                      <Printer className="size-3.5 mr-1" />
                      Imprimir
                    </Button>
                  )}
                </h3>
                {loadingServices ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <Clock className="size-6 mx-auto mb-2 animate-spin opacity-50" />
                    <p className="text-sm">Cargando...</p>
                  </div>
                ) : services.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <Wrench className="size-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay servicios asociados</p>
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
                              {s.vehicle_brand && s.vehicle_model
                                ? `${s.vehicle_brand} ${s.vehicle_model}`
                                : 'N/A'}
                            </td>
                            <td className="py-2 px-3 text-foreground font-mono text-xs">{s.license_plate || 'N/A'}</td>
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
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex flex-col sm:flex-row justify-between text-sm text-muted-foreground pt-4 mt-4 border-t gap-1">
          <span className="truncate">
            Creado: {formatForDisplayWithTime(invoice.createdAt)}
            {invoice.creatorName && ` por ${invoice.creatorName}`}
          </span>
          <span className="truncate">Actualizado: {formatForDisplayWithTime(invoice.updatedAt)}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
