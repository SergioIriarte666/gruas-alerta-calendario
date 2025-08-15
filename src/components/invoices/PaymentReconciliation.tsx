import React, { useState, useEffect } from 'react';
import { usePayments } from '@/hooks/usePayments';
import { useClients } from '@/hooks/useClients';
import { PaymentWithDetails } from '@/types/payments';
import { PaymentApplicationModal } from './PaymentApplicationModal';
import { SmartPaymentForm } from './SmartPaymentForm';
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
    getReconciliationStats,
    refetch // Agregado para actualización manual
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
  const [refreshing, setRefreshing] = useState(false);

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
      setLoadingSync(true);
      await applyPaymentFIFO(payment.id, payment.client_id);
      // Actualizar datos después de la operación
      await refetch();
      await loadReconciliationStats();
    } catch (error) {
      console.error('Error applying payment:', error);
    } finally {
      setLoadingSync(false);
    }
  };

  const handleManualApplication = async (payment: PaymentWithDetails) => {
    const invoices = await getUnpaidInvoicesForClient(payment.client_id);
    setAvailableInvoices(invoices);
    setSelectedPayment(payment);
    setShowApplicationModal(true);
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await refetch();
      await loadReconciliationStats();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
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

        {/* Stats Cards */}
        {reconciliationStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-white/10 border-white/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-400" />
                  <div>
                    <p className="text-sm text-gray-300">Pagos Pendientes</p>
                    <p className="text-xl font-bold text-white">{reconciliationStats.pending_payments || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 border-white/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-blue-400" />
                  <div>
                    <p className="text-sm text-gray-300">Monto Pendiente</p>
                    <p className="text-xl font-bold text-white">{formatCurrency(totalPendingAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 border-white/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-yellow-400" />
                  <div>
                    <p className="text-sm text-gray-300">Pagos Aplicados</p>
                    <p className="text-xl font-bold text-white">{reconciliationStats.applied_payments || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 border-white/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <div>
                    <p className="text-sm text-gray-300">Facturas Vencidas</p>
                    <p className="text-xl font-bold text-white">{reconciliationStats.overdue_invoices || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Controls */}
        <Card className="bg-white/10 border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Controles de Conciliación</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-64 bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="Filtrar por cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              onClick={handleRefresh}
              variant="outline"
              disabled={paymentsLoading || refreshing}
              className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar Lista
            </Button>

            <Button 
              onClick={async () => {
                setLoadingSync(true);
                try {
                  await syncPaidInvoicesWithPayments();
                  await loadReconciliationStats();
                  await refetch();
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
                  await refetch();
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

            <Button 
              onClick={() => setShowPaymentForm(true)} 
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Registrar Pago
            </Button>
            
            <Button 
              onClick={() => setShowHistory(true)} 
              variant="outline"
              className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white"
            >
              <History className="h-4 w-4 mr-2" />
              Historial
            </Button>
          </CardContent>
        </Card>

        {/* Payments Table */}
        <Card className="bg-white/10 border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Pagos Registrados ({filteredPayments.length})</CardTitle>
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
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id} className="border-white/10">
                    <TableCell className="text-white">{payment.client?.name}</TableCell>
                    <TableCell className="text-white">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell className="text-white">{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell className="text-white">{formatCurrency(payment.applied_amount || 0)}</TableCell>
                    <TableCell className="text-white">{formatCurrency(payment.remaining_amount || 0)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {(payment.remaining_amount || 0) > 0 && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleAutoApply(payment)}
                              className="bg-green-600 hover:bg-green-700"
                              disabled={loadingSync}
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
          <SmartPaymentForm
            onClose={() => {
              setShowPaymentForm(false);
              refetch(); // Actualizar después de cerrar el formulario
              loadReconciliationStats();
            }}
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
              refetch(); // Actualizar después de cerrar el modal de aplicación
              loadReconciliationStats();
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