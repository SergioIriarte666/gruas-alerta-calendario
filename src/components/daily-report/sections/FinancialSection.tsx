import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { 
  DollarSign,
  AlertTriangle,
  Clock,
  FileText,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Eye
} from 'lucide-react';

interface FinancialSectionProps {
  data?: {
    invoicesDue: any[];
    invoicesOverdue: any[];
    paymentsToMake: any[];
    paymentsPending: any[];
    invoicesToIssue: any[];
    totalDue: number;
    totalOverdue: number;
  } | null;
  onViewInvoice?: (invoice: any) => void;
  onViewPayment?: (payment: any) => void;
  onViewServiceToInvoice?: (service: any) => void;
}

export const FinancialSection = ({ data, onViewInvoice, onViewPayment, onViewServiceToInvoice }: FinancialSectionProps) => {
  if (!data) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">No hay datos financieros disponibles</p>
        </CardContent>
      </Card>
    );
  }

  const InvoiceCard = ({ invoice, isOverdue = false }: { invoice: any; isOverdue?: boolean }) => (
    <Card className={`${isOverdue ? 'border-red-200 bg-red-50' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{invoice.folio}</span>
              {isOverdue && <AlertTriangle className="w-4 h-4 text-red-500" />}
            </div>
            
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Cliente:</strong> {invoice.client?.name || 'N/A'}</p>
              <p><strong>Vencimiento:</strong> {invoice.due_date}</p>
              <p><strong>Total:</strong> {formatCurrency(invoice.total)}</p>
              <p><strong>Pendiente:</strong> {formatCurrency(invoice.total - (invoice.paid_amount || 0))}</p>
            </div>
          </div>
          
          <Button variant="ghost" size="sm" onClick={() => onViewInvoice?.(invoice)}>
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const PaymentCard = ({ payment }: { payment: any }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{formatCurrency(payment.amount)}</span>
              <Badge variant={payment.status === 'pending' ? 'secondary' : 'default'}>
                {payment.status === 'pending' ? 'Pendiente' : 'Programado'}
              </Badge>
            </div>
            
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Método:</strong> {payment.payment_method || 'N/A'}</p>
              <p><strong>Proveedor:</strong> {payment.supplier_invoice?.supplier_name || 'N/A'}</p>
              {payment.supplier_invoice?.invoice_number && (
                <p><strong>Factura:</strong> {payment.supplier_invoice.invoice_number}</p>
              )}
            </div>
          </div>
          
          <Button variant="ghost" size="sm" onClick={() => onViewPayment?.(payment)}>
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const ServiceToInvoiceCard = ({ service }: { service: any }) => (
    <Card className="border-green-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-500" />
              <span className="font-medium">{service.folio}</span>
              <Badge variant="outline" className="text-green-600">
                Listo para facturar
              </Badge>
            </div>
            
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Cliente:</strong> {service.client?.name || 'N/A'}</p>
              <p><strong>Fecha:</strong> {service.service_date}</p>
              <p><strong>Valor:</strong> {formatCurrency(service.value)}</p>
            </div>
          </div>
          
          <Button variant="ghost" size="sm" onClick={() => onViewServiceToInvoice?.(service)}>
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );


  return (
    <div className="space-y-6">
      {/* Resumen Financiero */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Por Cobrar Hoy</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(data.totalDue)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Vencido</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(data.totalOverdue)}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Servicios Listos</p>
                <p className="text-2xl font-bold text-green-600">{data.invoicesToIssue.length}</p>
              </div>
              <FileText className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Facturas Vencidas */}
      {data.invoicesOverdue.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Facturas Vencidas
              <Badge variant="destructive">{data.invoicesOverdue.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.invoicesOverdue.map((invoice) => (
                <InvoiceCard key={invoice.id} invoice={invoice} isOverdue />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Facturas con Vencimiento Hoy */}
      {data.invoicesDue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Facturas con Vencimiento Hoy
              <Badge variant="outline">{data.invoicesDue.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.invoicesDue.map((invoice) => (
                <InvoiceCard key={invoice.id} invoice={invoice} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}


      {/* Pagos a Realizar Hoy */}
      {data.paymentsToMake.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-500" />
              Pagos Programados Hoy
              <Badge variant="outline">{data.paymentsToMake.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.paymentsToMake.map((payment) => (
                <PaymentCard key={payment.id} payment={payment} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Servicios Listos para Facturar */}
      {data.invoicesToIssue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-500" />
              Servicios Listos para Facturar
              <Badge variant="outline">{data.invoicesToIssue.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.invoicesToIssue.slice(0, 5).map((service) => (
                <ServiceToInvoiceCard key={service.id} service={service} />
              ))}
              {data.invoicesToIssue.length > 5 && (
                <p className="text-sm text-muted-foreground text-center">
                  y {data.invoicesToIssue.length - 5} servicios más...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sin actividad financiera */}
      {data.invoicesDue.length === 0 && 
       data.invoicesOverdue.length === 0 && 
       data.paymentsToMake.length === 0 && 
       data.invoicesToIssue.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">
              No hay actividad financiera programada para este día
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};