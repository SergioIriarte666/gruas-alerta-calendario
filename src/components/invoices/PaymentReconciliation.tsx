import React, { useState, useEffect } from 'react';
import { usePayments } from '@/hooks/usePayments';
import { useClients } from '@/hooks/useClients';
import { PaymentWithDetails } from '@/types/payments';
import { PaymentApplicationModal } from './PaymentApplicationModal';
import { PaymentForm } from './PaymentForm';
import { PaymentHistory } from './PaymentHistory';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Zap, Edit, DollarSign, AlertTriangle, History, RefreshCw, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface PaymentReconciliationProps {
  onClose?: () => void;
}

export const PaymentReconciliation: React.FC<PaymentReconciliationProps> = ({ onClose }) => {
  const { 
    payments, 
    loading: paymentsLoading, 
    paymentSystemAvailable,
    applyPaymentFIFO,
    getUnpaidInvoicesForClient,
    checkPaymentSystemAvailability,
    cleanupDuplicatePayments,
    syncPaidInvoicesWithPayments,
    getReconciliationStats
  } = usePayments();
  
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithDetails | null>(null);
  const [availableInvoices, setAvailableInvoices] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [reconciliationStats, setReconciliationStats] = useState<any>(null);
  const [loadingCleanup, setLoadingCleanup] = useState(false);
  const [loadingSync, setLoadingSync] = useState(false);

  const { clients } = useClients();

  useEffect(() => {
    checkPaymentSystemAvailability();
    loadReconciliationStats();
  }, []);

  const loadReconciliationStats = async () => {
    try {
      const stats = await getReconciliationStats();
      setReconciliationStats(stats);
    } catch (error) {
      console.error('Error loading reconciliation stats:', error);
    }
  };

  const handleAutoApply = async (payment: PaymentWithDetails) => {
    try {
      await applyPaymentFIFO(payment.id, payment.client_id);
    } catch (error) {
      console.error('Error applying payment:', error);
    }
  };

  const handleManualApplication = async (payment: PaymentWithDetails) => {
    const invoices = await getUnpaidInvoicesForClient(payment.client_id);
    setAvailableInvoices(invoices);
    setSelectedPayment(payment);
    setShowApplicationModal(true);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'bg-yellow-500',
      applied: 'bg-green-500',
      partial: 'bg-blue-500',
      cancelled: 'bg-red-500'
    };
    return <Badge className={variants[status as keyof typeof variants] || 'bg-gray-500'}>{status}</Badge>;
  };

  if (!paymentSystemAvailable) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 p-6">
        <Alert className="max-w-2xl mx-auto">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            El sistema de conciliación de pagos no está disponible. Contacte al administrador.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const filteredPayments = selectedClient && selectedClient !== 'all'
    ? payments.filter(p => p.client_id === selectedClient)
    : payments;

  const pendingPayments = payments.filter(p => p.status === 'pending');
  const totalPendingAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Conciliación de Pagos</h2>
            <p className="text-gray-300">Gestiona y aplica pagos recibidos a facturas pendientes</p>
          </div>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Volver a Facturas
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Pagos Pendientes</CardTitle>
              <DollarSign className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{reconciliationStats?.pending_payments || 0}</div>
              <p className="text-xs text-gray-300">{formatCurrency(reconciliationStats?.total_pending_amount || 0)}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Pagos Aplicados</CardTitle>
              <DollarSign className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{reconciliationStats?.applied_payments || 0}</div>
              <p className="text-xs text-gray-300">Pagos completamente procesados</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Sin Pagos</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{reconciliationStats?.invoices_without_payments || 0}</div>
              <p className="text-xs text-gray-300">Facturas pagadas sin registro</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Sin Aplicar</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{reconciliationStats?.payments_without_applications || 0}</div>
              <p className="text-xs text-gray-300">Pagos no aplicados a facturas</p>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-full sm:w-64 bg-white/10 border-white/20 text-white">
              <SelectValue placeholder="Filtrar por cliente" />
            </SelectTrigger>
            <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients.map(client => (
                <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            onClick={async () => {
              setLoadingSync(true);
              try {
                await syncPaidInvoicesWithPayments();
                await loadReconciliationStats();
              } finally {
                setLoadingSync(false);
              }
            }}
            variant="outline"
            disabled={paymentsLoading || loadingSync}
            className="border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingSync ? 'animate-spin' : ''}`} />
            Sincronizar Pagadas
          </Button>

          <Button 
            onClick={async () => {
              setLoadingCleanup(true);
              try {
                await cleanupDuplicatePayments();
                await loadReconciliationStats();
              } finally {
                setLoadingCleanup(false);
              }
            }}
            variant="outline"
            disabled={paymentsLoading || loadingCleanup}
            className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
          >
            <Trash2 className={`h-4 w-4 mr-2 ${loadingCleanup ? 'animate-spin' : ''}`} />
            Limpiar Duplicados
          </Button>

          <Button onClick={() => setShowPaymentForm(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Registrar Pago
          </Button>
          
          <Button 
            onClick={() => setShowHistory(true)} 
            variant="outline"
            className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white"
          >
            <History className="h-4 w-4 mr-2" />
            Ver Historial
          </Button>
        </div>

        {/* Payments Table */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Pagos Registrados</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-white/20">
                  <TableHead className="text-gray-300">Cliente</TableHead>
                  <TableHead className="text-gray-300">Monto</TableHead>
                  <TableHead className="text-gray-300">Fecha</TableHead>
                  <TableHead className="text-gray-300">Estado</TableHead>
                  <TableHead className="text-gray-300">Aplicado</TableHead>
                  <TableHead className="text-gray-300">Pendiente</TableHead>
                  <TableHead className="text-gray-300">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map(payment => (
                  <TableRow key={payment.id} className="border-white/20">
                    <TableCell className="text-white">{payment.client?.name}</TableCell>
                    <TableCell className="text-white">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell className="text-white">{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell className="text-white">{formatCurrency(payment.applied_amount)}</TableCell>
                    <TableCell className="text-white">{formatCurrency(payment.remaining_amount)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {payment.remaining_amount > 0 && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleAutoApply(payment)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Zap className="h-3 w-3 mr-1" />
                              Auto
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleManualApplication(payment)}
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Manual
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Modals */}
        {showPaymentForm && (
          <PaymentForm
            onClose={() => setShowPaymentForm(false)}
            onCancel={() => setShowPaymentForm(false)}
            preselectedClientId={selectedClient === 'all' ? undefined : selectedClient}
          />
        )}

        {showApplicationModal && selectedPayment && (
          <PaymentApplicationModal
            payment={selectedPayment}
            availableInvoices={availableInvoices}
            onClose={() => {
              setShowApplicationModal(false);
              setSelectedPayment(null);
            }}
          />
        )}

        {showHistory && (
          <PaymentHistory onClose={() => setShowHistory(false)} />
        )}
      </div>
    </div>
  );
};