import { businessClock } from '@/utils/businessClock';
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
import { safeDateToDisplaySlashes } from '@/utils/timezoneUtils';
import { PaymentWithDetails } from '@/types/payments';
import { usePaymentApplications, PaymentApplicationDetail } from '@/hooks/usePaymentApplications';
import { createLogger } from "@/lib/logger";


const logger = createLogger("PaymentApplicationsDetailModal");
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
      logger.error('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!payment) return null;

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { 
        className: 'border-warning/30 bg-warning/10 text-warning',
        icon: Clock,
        label: 'Pendiente'
      },
      applied: { 
        className: 'border-success/30 bg-success/10 text-success',
        icon: CheckCircle,
        label: 'Aplicado'
      },
      partial: { 
        className: 'border-info/30 bg-info/10 text-info',
        icon: AlertTriangle,
        label: 'Parcial'
      },
      cancelled: { 
        className: 'border-danger/30 bg-danger/10 text-danger',
        icon: AlertTriangle,
        label: 'Cancelado'
      }
    };
    
    const config = variants[status as keyof typeof variants] || variants.pending;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.className} flex items-center gap-1`}>
        <Icon className="size-3" />
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
      <DialogContent className="max-h-[90vh] max-w-4xl w-[95vw] border-border/70 bg-card p-0 flex flex-col">
        <DialogHeader className="shrink-0 border-b border-border/70 bg-muted/20 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Receipt className="size-5 text-primary" />
            Detalle del Pago
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 px-6 py-6 overflow-y-auto flex-1 min-h-0">
          {/* Estado del Pago */}
          <div className="flex justify-between items-center">
            {getStatusBadge(payment.status)}
            <div className="text-sm text-muted-foreground">
              ID: {payment.id.slice(0, 8)}...
            </div>
          </div>

          {/* Resumen del Pago */}
          <Card className="border-info/20 bg-info/10">
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <DollarSign className="size-4" />
                Resumen del Pago
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Monto Total</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(payment.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monto Aplicado</p>
                  <p className="text-lg font-bold text-success">
                    {formatCurrency(payment.applied_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monto Restante</p>
                  <p className="text-lg font-bold text-warning">
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
                <CreditCard className="size-4" />
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
                    {safeDateToDisplaySlashes(payment.payment_date)}
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
                <p className="rounded-lg border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
                  {payment.notes}
                </p>
              </div>
            )}
          </div>

          {/* Facturas Aplicadas */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="size-4" />
              Facturas Aplicadas ({applications.length})
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : applications.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-border/70">
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
                        <TableCell className="text-right text-sm font-semibold text-success">
                          {formatCurrency(app.applied_amount)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {businessClock.dateLabel(app.created_at)}
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
                <FileText className="size-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay facturas aplicadas a este pago</p>
              </div>
            )}
          </div>

          {/* Fecha de Creación */}
          <div className="flex items-center justify-between border-t border-border/70 pt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="size-3" />
              Creado: {new Date(payment.created_at).toLocaleString()}
            </div>
            {payment.updated_at !== payment.created_at && (
              <div className="flex items-center gap-1">
                <Calendar className="size-3" />
                Actualizado: {new Date(payment.updated_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
