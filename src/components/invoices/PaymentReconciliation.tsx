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
import { Plus, Zap, Edit, DollarSign, AlertTriangle, History, RefreshCw } from 'lucide-react';
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
    fixPaymentInconsistencies,
    validateSystemIntegrity,
    performBackgroundMaintenance,
    fixSystemInconsistencies,
    removeDuplicateApplications,
    getComprehensiveDiagnosis,
    fixPaymentApplicationConflicts
  } = usePayments();
  
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithDetails | null>(null);
  const [availableInvoices, setAvailableInvoices] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [reconciliationStats, setReconciliationStats] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [systemDiagnosis, setSystemDiagnosis] = useState<any>(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [showMaintenancePanel, setShowMaintenancePanel] = useState(false);

  const { clients } = useClients();

  useEffect(() => {
    checkPaymentSystemAvailability();
    loadReconciliationStats();
    loadSystemDiagnosis();
    // Ejecutar correcciones automáticas en segundo plano
    performAutomaticMaintenance();
  }, []);

  const performAutomaticMaintenance = async () => {
    try {
      await performBackgroundMaintenance();
      await loadReconciliationStats();
      await loadSystemDiagnosis();
    } catch (error) {
      console.error('Error in automatic maintenance:', error);
    }
  };

  const loadReconciliationStats = async () => {
    try {
      const stats = await getReconciliationStats();
      setReconciliationStats(stats);
    } catch (error) {
      console.error('Error loading reconciliation stats:', error);
    }
  };

  const loadSystemDiagnosis = async () => {
    setDiagnosisLoading(true);
    try {
      const diagnosis = await getComprehensiveDiagnosis();
      setSystemDiagnosis(diagnosis);
      
      // Si hay problemas y el panel de mantenimiento no está abierto, abrirlo automáticamente
      if (diagnosis.system_health === 'NEEDS_REPAIR' && !showMaintenancePanel) {
        setShowMaintenancePanel(true);
      }
    } catch (error) {
      console.error('Error loading system diagnosis:', error);
    } finally {
      setDiagnosisLoading(false);
    }
  };


  const handleAutoApply = async (payment: PaymentWithDetails) => {
    try {
      setIsProcessing(true);
      await applyPaymentFIFO(payment.id, payment.client_id);
      await loadReconciliationStats();
    } catch (error) {
      console.error('Error applying payment:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualApplication = async (payment: PaymentWithDetails) => {
    const invoices = await getUnpaidInvoicesForClient(payment.client_id);
    setAvailableInvoices(invoices);
    setSelectedPayment(payment);
    setShowApplicationModal(true);
  };

  const handleRefresh = async () => {
    setIsProcessing(true);
    try {
      await performAutomaticMaintenance();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFixPaymentConflicts = async () => {
    setIsProcessing(true);
    try {
      await fixPaymentApplicationConflicts();
      await loadReconciliationStats();
      await loadSystemDiagnosis();
    } finally {
      setIsProcessing(false);
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
      <div className="min-h-screen bg-background p-6">
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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Conciliación de Pagos</h2>
            <p className="text-muted-foreground">Registra y aplica pagos recibidos a facturas pendientes</p>
          </div>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Volver a Facturas
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-card border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Pagos Pendientes</CardTitle>
              <DollarSign className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{reconciliationStats?.pending_payments || 0}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(reconciliationStats?.total_pending_amount || 0)}</p>
            </CardContent>
          </Card>

          <Card className="bg-card border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Pagos Aplicados</CardTitle>
              <DollarSign className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{reconciliationStats?.applied_payments || 0}</div>
              <p className="text-xs text-muted-foreground">Pagos completamente procesados</p>
            </CardContent>
          </Card>

          <Card className="bg-card border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Facturas sin Pago</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{reconciliationStats?.invoices_without_payments || 0}</div>
              <p className="text-xs text-muted-foreground">Facturas marcadas como pagadas sin registro</p>
            </CardContent>
          </Card>

          <Card className="bg-card border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Pagos sin Aplicar</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{reconciliationStats?.payments_without_applications || 0}</div>
              <p className="text-xs text-muted-foreground">Pagos registrados pendientes de aplicar</p>
            </CardContent>
          </Card>
        </div>

        {/* Controls - Simplificados */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Filtrar por cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients.map(client => (
                <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            onClick={handleRefresh}
            variant="outline"
            disabled={paymentsLoading || isProcessing}
            className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          <Button 
            onClick={handleFixPaymentConflicts}
            variant="outline"
            disabled={paymentsLoading || isProcessing}
            className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Corregir Conflictos
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
        <Card className="bg-card border">
          <CardHeader>
            <CardTitle className="text-foreground">Pagos Registrados</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-muted-foreground">N° Fiscal</TableHead>
                  <TableHead className="text-muted-foreground">Monto</TableHead>
                  <TableHead className="text-muted-foreground">Fecha</TableHead>
                  <TableHead className="text-muted-foreground">Estado</TableHead>
                  <TableHead className="text-muted-foreground">Aplicado</TableHead>
                  <TableHead className="text-muted-foreground">Pendiente</TableHead>
                  <TableHead className="text-muted-foreground">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map(payment => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-foreground">{payment.client?.name}</TableCell>
                    <TableCell className="text-foreground">
                      {payment.fiscal_numbers && payment.fiscal_numbers.length > 0 
                        ? payment.fiscal_numbers.join(', ') 
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-foreground">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell className="text-foreground">{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell className="text-foreground">{formatCurrency(payment.applied_amount)}</TableCell>
                    <TableCell className="text-foreground">{formatCurrency(payment.remaining_amount)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {payment.remaining_amount > 0 && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleAutoApply(payment)}
                              disabled={isProcessing}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Zap className="h-3 w-3 mr-1" />
                              Aplicar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleManualApplication(payment)}
                              disabled={isProcessing}
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
            onClose={() => setShowPaymentForm(false)}
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