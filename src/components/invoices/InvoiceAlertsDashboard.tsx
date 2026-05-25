import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, DollarSign, FileText } from 'lucide-react';
import { useInvoiceAlerts } from '@/hooks/useInvoiceAlerts';
import { useNavigate } from 'react-router-dom';

export const InvoiceAlertsDashboard = () => {
  const { overdueInvoices, invoicesDueSoon, loading } = useInvoiceAlerts();
  const navigate = useNavigate();

  const totalOverdueAmount = overdueInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const totalDueSoonAmount = invoicesDueSoon.reduce((sum, invoice) => sum + invoice.total, 0);

  if (loading) {
    return <div className="animate-pulse">Cargando alertas...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Resumen de Alertas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/60 backdrop-blur-sm border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              <div>
                <p className="text-sm font-medium">Facturas Vencidas</p>
                <p className="text-2xl font-bold text-destructive">{overdueInvoices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur-sm border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="size-5 text-destructive" />
              <div>
                <p className="text-sm font-medium">Monto Vencido</p>
                <p className="text-2xl font-bold text-destructive">
                  ${totalOverdueAmount.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur-sm border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="size-5 text-warning" />
              <div>
                <p className="text-sm font-medium">Vencen Pronto</p>
                <p className="text-2xl font-bold text-warning">{invoicesDueSoon.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur-sm border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="size-5 text-warning" />
              <div>
                <p className="text-sm font-medium">Monto por Vencer</p>
                <p className="text-2xl font-bold text-warning">
                  ${totalDueSoonAmount.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Facturas Vencidas */}
      {overdueInvoices.length > 0 && (
        <Card className="bg-card/60 backdrop-blur-sm border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Facturas Vencidas ({overdueInvoices.length})
            </CardTitle>
            <CardDescription>
              Facturas que han pasado su fecha de vencimiento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overdueInvoices.slice(0, 5).map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-destructive/5 border-destructive/20"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="size-4 text-destructive" />
                    <div>
                      <p className="font-medium">{invoice.folio}</p>
                      <p className="text-sm text-muted-foreground">{invoice.client_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${invoice.total.toLocaleString()}</p>
                    <Badge variant="destructive">
                      {invoice.days_overdue} días vencida
                    </Badge>
                  </div>
                </div>
              ))}
              {overdueInvoices.length > 5 && (
                <Button
                  variant="outline"
                  onClick={() => navigate('/invoices?status=overdue')}
                  className="w-full"
                >
                  Ver todas las facturas vencidas ({overdueInvoices.length})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Facturas Próximas a Vencer */}
      {invoicesDueSoon.length > 0 && (
        <Card className="bg-card/60 backdrop-blur-sm border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <Clock className="size-5" />
              Facturas Próximas a Vencer ({invoicesDueSoon.length})
            </CardTitle>
            <CardDescription>
              Facturas que vencen en los próximos días
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoicesDueSoon.slice(0, 5).map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-warning/5 border-warning/20"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="size-4 text-warning" />
                    <div>
                      <p className="font-medium">{invoice.folio}</p>
                      <p className="text-sm text-muted-foreground">{invoice.client_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${invoice.total.toLocaleString()}</p>
                    <Badge className="bg-warning/20 text-warning border-warning/30">
                      Vence en {invoice.days_until_due} días
                    </Badge>
                  </div>
                </div>
              ))}
              {invoicesDueSoon.length > 5 && (
                <Button
                  variant="outline"
                  onClick={() => navigate('/invoices?status=sent')}
                  className="w-full"
                >
                  Ver todas las facturas pendientes ({invoicesDueSoon.length})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};