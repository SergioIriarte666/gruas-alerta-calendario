import React, { useState, useEffect } from 'react';
import { usePayments } from '@/hooks/usePayments';
import { useClients } from '@/hooks/useClients';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  History, 
  DollarSign, 
  FileText, 
  Calendar, 
  CreditCard,
  RefreshCw,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { PaymentApplicationsDetailModal } from './PaymentApplicationsDetailModal';
import { PaymentWithDetails } from '@/types/payments';

interface PaymentHistoryProps {
  onClose?: () => void;
}

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({ onClose }) => {
  const { 
    syncExistingPaidInvoices, 
    getClientPaymentHistory,
    paymentSystemAvailable 
  } = usePayments();
  
  const { clients } = useClients();
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [historyData, setHistoryData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showPaymentDetail, setShowPaymentDetail] = useState(false);
  const [selectedPaymentForDetail, setSelectedPaymentForDetail] = useState<PaymentWithDetails | null>(null);

  const handleSyncPaidInvoices = async () => {
    setSyncing(true);
    try {
      await syncExistingPaidInvoices();
      if (selectedClient) {
        await loadClientHistory(selectedClient);
      }
    } catch (error) {
      console.error('Error syncing:', error);
    } finally {
      setSyncing(false);
    }
  };

  const loadClientHistory = async (clientId: string) => {
    if (!clientId) return;
    
    setLoading(true);
    try {
      const data = await getClientPaymentHistory(clientId);
      setHistoryData(data);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClient) {
      loadClientHistory(selectedClient);
    }
  }, [selectedClient]);

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { color: 'bg-yellow-500', icon: Clock },
      applied: { color: 'bg-green-500', icon: CheckCircle },
      partial: { color: 'bg-blue-500', icon: TrendingUp },
      cancelled: { color: 'bg-red-500', icon: AlertTriangle },
      paid: { color: 'bg-green-500', icon: CheckCircle },
      sent: { color: 'bg-blue-500', icon: FileText },
      overdue: { color: 'bg-red-500', icon: AlertTriangle },
      draft: { color: 'bg-gray-500', icon: FileText }
    };
    
    const config = variants[status as keyof typeof variants] || variants.draft;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} text-white flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  if (!paymentSystemAvailable) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Alert className="max-w-2xl mx-auto">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            El sistema de historial de pagos no está disponible. Contacte al administrador.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <History className="h-6 w-6" />
              Historial de Pagos y Facturas
            </h2>
            <p className="text-muted-foreground">Consulta el historial completo de pagos y facturas por cliente</p>
          </div>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Volver
            </Button>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Seleccionar cliente" />
            </SelectTrigger>
            <SelectContent>
              {clients.map(client => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}{client.department ? ` - ${client.department}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            onClick={handleSyncPaidInvoices} 
            disabled={syncing}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar Facturas Pagadas'}
          </Button>
        </div>

        {/* Summary Cards */}
        {historyData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-card border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Total Facturas</CardTitle>
                <FileText className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{historyData.summary.total_invoices}</div>
                <p className="text-xs text-muted-foreground">{formatCurrency(historyData.summary.total_invoiced)}</p>
              </CardContent>
            </Card>

            <Card className="bg-card border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Total Pagado</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{historyData.summary.paid_invoices_count}</div>
                <p className="text-xs text-muted-foreground">{formatCurrency(historyData.summary.total_paid)}</p>
              </CardContent>
            </Card>

            <Card className="bg-card border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Pendiente</CardTitle>
                <Clock className="h-4 w-4 text-yellow-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{historyData.summary.pending_invoices_count}</div>
                <p className="text-xs text-muted-foreground">{formatCurrency(historyData.summary.total_pending)}</p>
              </CardContent>
            </Card>

            <Card className="bg-card border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">% Pagado</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {historyData.summary.total_invoiced > 0 
                    ? Math.round((historyData.summary.total_paid / historyData.summary.total_invoiced) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">Efectividad de cobro</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* History Tables */}
        {historyData && (
          <Tabs defaultValue="invoices" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="invoices">Facturas</TabsTrigger>
              <TabsTrigger value="payments">Pagos</TabsTrigger>
            </TabsList>

            <TabsContent value="invoices">
              <Card className="bg-card border">
                <CardHeader>
                  <CardTitle className="text-foreground">Historial de Facturas</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-muted-foreground">Folio</TableHead>
                        <TableHead className="text-muted-foreground">Fecha Emisión</TableHead>
                        <TableHead className="text-muted-foreground">Fecha Venc.</TableHead>
                        <TableHead className="text-muted-foreground">Total</TableHead>
                        <TableHead className="text-muted-foreground">Pagado</TableHead>
                        <TableHead className="text-muted-foreground">Pendiente</TableHead>
                        <TableHead className="text-muted-foreground">Estado</TableHead>
                        <TableHead className="text-muted-foreground">Fecha Pago</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyData.invoices.map((invoice: any) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="text-foreground font-medium">{invoice.folio}</TableCell>
                          <TableCell className="text-foreground">{new Date(invoice.issue_date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-foreground">{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-foreground">{formatCurrency(invoice.total)}</TableCell>
                          <TableCell className="text-foreground">{formatCurrency(invoice.paid_amount)}</TableCell>
                          <TableCell className="text-foreground">{formatCurrency(invoice.remaining_amount)}</TableCell>
                          <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                          <TableCell className="text-foreground">
                            {invoice.payment_date ? new Date(invoice.payment_date).toLocaleDateString() : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments">
              <Card className="bg-card border">
                <CardHeader>
                  <CardTitle className="text-foreground">Historial de Pagos</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-muted-foreground">Fecha Pago</TableHead>
                        <TableHead className="text-muted-foreground">Monto</TableHead>
                        <TableHead className="text-muted-foreground">Método</TableHead>
                        <TableHead className="text-muted-foreground">Aplicado</TableHead>
                        <TableHead className="text-muted-foreground">Pendiente</TableHead>
                        <TableHead className="text-muted-foreground">Estado</TableHead>
                        <TableHead className="text-muted-foreground">Referencia</TableHead>
                        <TableHead className="text-muted-foreground">Facturas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyData.payments.map((payment: any) => (
                        <TableRow key={payment.id}>
                          <TableCell className="text-foreground">{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-foreground">{formatCurrency(payment.amount)}</TableCell>
                          <TableCell className="text-foreground">{payment.payment_method}</TableCell>
                          <TableCell className="text-foreground">{formatCurrency(payment.applied_amount)}</TableCell>
                          <TableCell className="text-foreground">{formatCurrency(payment.remaining_amount)}</TableCell>
                          <TableCell>{getStatusBadge(payment.status)}</TableCell>
                          <TableCell className="text-foreground text-xs">{payment.bank_reference || '-'}</TableCell>
                          <TableCell className="text-foreground text-xs">
                            {payment.applications && payment.applications.length > 0 ? (
                              <div className="flex items-center gap-2">
                                <span>{payment.applications.length} factura(s)</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                                  onClick={() => {
                                    setSelectedPaymentForDetail(payment);
                                    setShowPaymentDetail(true);
                                  }}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-foreground">Cargando historial...</div>
          </div>
        )}

        {/* Empty State */}
        {!selectedClient && (
          <Card className="bg-card border">
            <CardContent className="flex flex-col items-center justify-center h-64">
              <History className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-foreground text-lg mb-2">Selecciona un cliente</p>
              <p className="text-muted-foreground text-center">
                Elige un cliente para ver su historial completo de pagos y facturas
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de Detalle de Aplicaciones de Pago */}
      {showPaymentDetail && selectedPaymentForDetail && (
        <PaymentApplicationsDetailModal
          payment={selectedPaymentForDetail}
          isOpen={showPaymentDetail}
          onClose={() => {
            setShowPaymentDetail(false);
            setSelectedPaymentForDetail(null);
          }}
        />
      )}
    </div>
  );
};