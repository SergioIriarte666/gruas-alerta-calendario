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
  AlertTriangle
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 p-6">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <History className="h-6 w-6" />
              Historial de Pagos y Facturas
            </h2>
            <p className="text-gray-300">Consulta el historial completo de pagos y facturas por cliente</p>
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
            <SelectTrigger className="w-full sm:w-64 bg-white/10 border-white/20 text-white">
              <SelectValue placeholder="Seleccionar cliente" />
            </SelectTrigger>
            <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
              {clients.map(client => (
                <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
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
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white">Total Facturas</CardTitle>
                <FileText className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{historyData.summary.total_invoices}</div>
                <p className="text-xs text-gray-300">{formatCurrency(historyData.summary.total_invoiced)}</p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white">Total Pagado</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{historyData.summary.paid_invoices_count}</div>
                <p className="text-xs text-gray-300">{formatCurrency(historyData.summary.total_paid)}</p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white">Pendiente</CardTitle>
                <Clock className="h-4 w-4 text-yellow-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{historyData.summary.pending_invoices_count}</div>
                <p className="text-xs text-gray-300">{formatCurrency(historyData.summary.total_pending)}</p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white">% Pagado</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {historyData.summary.total_invoiced > 0 
                    ? Math.round((historyData.summary.total_paid / historyData.summary.total_invoiced) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-gray-300">Efectividad de cobro</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* History Tables */}
        {historyData && (
          <Tabs defaultValue="invoices" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 bg-white/10">
              <TabsTrigger value="invoices" className="text-white">Facturas</TabsTrigger>
              <TabsTrigger value="payments" className="text-white">Pagos</TabsTrigger>
            </TabsList>

            <TabsContent value="invoices">
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">Historial de Facturas</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/20">
                        <TableHead className="text-gray-300">Folio</TableHead>
                        <TableHead className="text-gray-300">Fecha Emisión</TableHead>
                        <TableHead className="text-gray-300">Fecha Venc.</TableHead>
                        <TableHead className="text-gray-300">Total</TableHead>
                        <TableHead className="text-gray-300">Pagado</TableHead>
                        <TableHead className="text-gray-300">Pendiente</TableHead>
                        <TableHead className="text-gray-300">Estado</TableHead>
                        <TableHead className="text-gray-300">Fecha Pago</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyData.invoices.map((invoice: any) => (
                        <TableRow key={invoice.id} className="border-white/20">
                          <TableCell className="text-white font-medium">{invoice.folio}</TableCell>
                          <TableCell className="text-white">{new Date(invoice.issue_date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-white">{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-white">{formatCurrency(invoice.total)}</TableCell>
                          <TableCell className="text-white">{formatCurrency(invoice.paid_amount)}</TableCell>
                          <TableCell className="text-white">{formatCurrency(invoice.remaining_amount)}</TableCell>
                          <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                          <TableCell className="text-white">
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
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">Historial de Pagos</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/20">
                        <TableHead className="text-gray-300">Fecha Pago</TableHead>
                        <TableHead className="text-gray-300">Monto</TableHead>
                        <TableHead className="text-gray-300">Método</TableHead>
                        <TableHead className="text-gray-300">Aplicado</TableHead>
                        <TableHead className="text-gray-300">Pendiente</TableHead>
                        <TableHead className="text-gray-300">Estado</TableHead>
                        <TableHead className="text-gray-300">Referencia</TableHead>
                        <TableHead className="text-gray-300">Facturas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyData.payments.map((payment: any) => (
                        <TableRow key={payment.id} className="border-white/20">
                          <TableCell className="text-white">{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-white">{formatCurrency(payment.amount)}</TableCell>
                          <TableCell className="text-white">{payment.payment_method}</TableCell>
                          <TableCell className="text-white">{formatCurrency(payment.applied_amount)}</TableCell>
                          <TableCell className="text-white">{formatCurrency(payment.remaining_amount)}</TableCell>
                          <TableCell>{getStatusBadge(payment.status)}</TableCell>
                          <TableCell className="text-white text-xs">{payment.bank_reference || '-'}</TableCell>
                          <TableCell className="text-white text-xs">
                            {payment.applications?.map((app: any) => app.invoice_folio).join(', ') || '-'}
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
            <div className="text-white">Cargando historial...</div>
          </div>
        )}

        {/* Empty State */}
        {!selectedClient && (
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="flex flex-col items-center justify-center h-64">
              <History className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-white text-lg mb-2">Selecciona un cliente</p>
              <p className="text-gray-300 text-center">
                Elige un cliente para ver su historial completo de pagos y facturas
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};