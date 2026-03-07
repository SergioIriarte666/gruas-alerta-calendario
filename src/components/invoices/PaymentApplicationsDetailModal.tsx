import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { 
  DollarSign, 
  FileText, 
  Calendar, 
  CreditCard,
  Receipt,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { PaymentWithDetails } from '@/types/payments';
import { usePaymentApplications, PaymentApplicationDetail } from '@/hooks/usePaymentApplications';

interface PaymentApplicationsDetailModalProps {
  payment: PaymentWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PaymentApplicationsDetailModal: React.FC<PaymentApplicationsDetailModalProps> = ({
  payment,
  isOpen,
  onClose
}) => {
  const { getPaymentApplicationsDetail } = usePaymentApplications();
  const [applications, setApplications] = useState<PaymentApplicationDetail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (payment && isOpen) {
      loadApplications();
    }
  }, [payment, isOpen]);

  const loadApplications = async () => {
    if (!payment) return;
    
    setLoading(true);
    try {
      const data = await getPaymentApplicationsDetail(payment.id);
      setApplications(data);
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!payment) return null;

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { 
        style: { backgroundColor: 'hsl(var(--warning))' },
        icon: Clock,
        label: 'Pendiente'
      },
      applied: { 
        style: { backgroundColor: 'hsl(var(--success))' },
        icon: CheckCircle,
        label: 'Aplicado'
      },
      partial: { 
        style: { backgroundColor: 'hsl(var(--info))' },
        icon: AlertTriangle,
        label: 'Parcial'
      },
      cancelled: { 
        style: { backgroundColor: 'hsl(var(--destructive))' },
        icon: AlertTriangle,
        label: 'Cancelado'
      }
    };
    
    const config = variants[status as keyof typeof variants] || variants.pending;
    const Icon = config.icon;
    
    return (
      <Badge style={config.style} className="text-white flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      manual: 'Manual',
      fifo: 'Automático (legado)',
      proportional: 'Proporcional'
    };
    return labels[method] || method;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Receipt className="h-5 w-5" />
            Detalle del Pago
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Estado del Pago */}
          <div className="flex justify-between items-center">
            {getStatusBadge(payment.status)}
            <div className="text-sm text-muted-foreground">
              ID: {payment.id.slice(0, 8)}...
            </div>
          </div>

          {/* Resumen del Pago */}
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Resumen del Pago
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Monto Total</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(payment.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monto Aplicado</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(payment.applied_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monto Restante</p>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                    {formatCurrency(payment.remaining_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Facturas Pagadas</p>
                  <p className="text-lg font-bold text-foreground">{applications.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información del Pago */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Información del Pago
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-medium text-foreground">{payment.client?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha Pago:</span>
                  <span className="font-medium text-foreground">
                    {new Date(payment.payment_date).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Método:</span>
                  <span className="font-medium text-foreground">{payment.payment_method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ref. Bancaria:</span>
                  <span className="font-medium text-foreground">{payment.bank_reference || '-'}</span>
                </div>
              </div>
            </div>

            {payment.notes && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Notas</h3>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  {payment.notes}
                </p>
              </div>
            )}
          </div>

          {/* Facturas Aplicadas */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Facturas Aplicadas ({applications.length})
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : applications.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs font-semibold">Folio</TableHead>
                      <TableHead className="text-xs font-semibold">N° Fiscal</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Total Factura</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Monto Aplicado</TableHead>
                      <TableHead className="text-xs font-semibold">Fecha Aplicación</TableHead>
                      <TableHead className="text-xs font-semibold">Método</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applications.map((app) => (
                      <TableRow key={app.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium text-sm">{app.invoice.folio}</TableCell>
                        <TableCell className="text-sm">{app.invoice.numero_fiscal}</TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(app.invoice.total)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm text-green-600 dark:text-green-400">
                          {formatCurrency(app.applied_amount)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(app.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {getMethodLabel(app.application_method)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay facturas aplicadas a este pago</p>
              </div>
            )}
          </div>

          {/* Fecha de Creación */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Creado: {new Date(payment.created_at).toLocaleString()}
            </div>
            {payment.updated_at !== payment.created_at && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Actualizado: {new Date(payment.updated_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
