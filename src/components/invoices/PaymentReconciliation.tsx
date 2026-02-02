import React, { useState, useEffect } from 'react';
import { usePayments } from '@/hooks/usePayments';
import { useClients } from '@/hooks/useClients';
import { PaymentWithDetails } from '@/types/payments';
import { PaymentApplicationModal } from './PaymentApplicationModal';
import { SmartPaymentForm } from './SmartPaymentForm';
import { PaymentHistory } from './PaymentHistory';
import { SelectivePaymentModal } from './SelectivePaymentModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Zap, Edit, DollarSign, AlertTriangle, History, RefreshCw, Eye } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { PaymentApplicationsDetailModal } from './PaymentApplicationsDetailModal';

interface PaymentReconciliationProps {
  onClose?: () => void;
}

export const PaymentReconciliation: React.FC<PaymentReconciliationProps> = ({ onClose }) => {
  const { 
    payments, 
    loading: paymentsLoading, 
    paymentSystemAvailable,
    applyPaymentFIFO,
    applyPaymentSelective,
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
    refetch,
  } = usePayments();
  
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithDetails | null>(null);
  const [availableInvoices, setAvailableInvoices] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectivePaymentModalOpen, setSelectivePaymentModalOpen] = useState(false);
  const [reconciliationStats, setReconciliationStats] = useState<any>(null);
  const [systemDiagnosis, setSystemDiagnosis] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentDetail, setShowPaymentDetail] = useState(false);
  const [selectedPaymentForDetail, setSelectedPaymentForDetail] = useState<PaymentWithDetails | null>(null);

  const { clients } = useClients();

  useEffect(() => {
    loadReconciliationStats();
    loadSystemDiagnosis();
  }, []);

  const handleAutoApply = async (payment: PaymentWithDetails) => {
    try {
      await applyPaymentFIFO(payment.id, payment.client_id);
      toast.success('Pago aplicado automáticamente');
    } catch (error) {
      console.error('Error auto-applying payment:', error);
    }
  };

  const handleManualApplication = async (payment: PaymentWithDetails) => {
    try {
      const invoices = await getUnpaidInvoicesForClient(payment.client_id);
      setAvailableInvoices(invoices);
      setSelectedPayment(payment);
      setShowApplicationModal(true);
    } catch (error) {
      console.error('Error loading invoices:', error);
      toast.error('Error al cargar facturas pendientes');
    }
  };

  const handleSelectiveApplication = async (fiscalNumbers: string[], applyOnlyToSpecified: boolean = true) => {
    if (!selectedPayment) return;
    
    try {
      await applyPaymentSelective(selectedPayment.id, fiscalNumbers, applyOnlyToSpecified);
      setSelectivePaymentModalOpen(false);
      setSelectedPayment(null);
      await refetch();
    } catch (error) {
      console.error('Error in selective application:', error);
    }
  };

  const performAutomaticMaintenance = async () => {
    setIsProcessing(true);
    try {
      await loadReconciliationStats();
      await loadSystemDiagnosis();
    } finally {
      setIsProcessing(false);
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
    try {
      const diagnosis = await getComprehensiveDiagnosis();
      setSystemDiagnosis(diagnosis);
    } catch (error) {
      console.error('Error loading system diagnosis:', error);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'applied': return 'default';
      case 'partial': return 'secondary';
      case 'pending': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'applied': return 'Aplicado';
      case 'partial': return 'Parcial';
      case 'pending': return 'Pendiente';
      default: return status;
    }
  };

  const filteredPayments = selectedClient === 'all' 
    ? payments 
    : payments.filter(payment => payment.client_id === selectedClient);

  if (!paymentSystemAvailable) {
    return (
      <Alert className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Sistema de pagos no disponible. Por favor, contacte al administrador.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Conciliación de Pagos</h2>
        <div className="flex gap-2">
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            disabled={paymentsLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${paymentsLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button
            onClick={() => setShowPaymentForm(true)}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Registrar Pago
          </Button>
          <Button
            onClick={() => setShowHistory(true)}
            variant="outline"
            size="sm"
          >
            <History className="h-4 w-4 mr-2" />
            Historial
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      {reconciliationStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pendientes</p>
                  <p className="text-2xl font-bold">{reconciliationStats.pending_payments || 0}</p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Aplicados</p>
                  <p className="text-2xl font-bold">{reconciliationStats.applied_payments || 0}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Parciales</p>
                  <p className="text-2xl font-bold">{reconciliationStats.partial_payments || 0}</p>
                </div>
                <DollarSign className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Monto</p>
                  <p className="text-2xl font-bold">{formatCurrency(reconciliationStats.total_amount || 0)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-4 items-center">
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-full sm:w-[300px]">
            <SelectValue placeholder="Filtrar por cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla de pagos */}
      <Card>
        <CardHeader>
          <CardTitle>Pagos Registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {paymentsLoading ? (
            <div className="text-center py-8">Cargando pagos...</div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay pagos registrados
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Aplicado</TableHead>
                  <TableHead>Pendiente</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{payment.client?.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {payment.bank_reference}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell>
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(payment.status)}>
                        {getStatusLabel(payment.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(payment.applied_amount)}</TableCell>
                    <TableCell>{formatCurrency(payment.remaining_amount)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {payment.status === 'pending' || payment.remaining_amount > 0 ? (
                          <>
                            <Button
                              onClick={() => handleManualApplication(payment)}
                              size="sm"
                              variant="default"
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Aplicar Manualmente
                            </Button>
                            <Button
                              onClick={() => {
                                setSelectedPayment(payment);
                                setSelectivePaymentModalOpen(true);
                              }}
                              size="sm"
                              variant="outline"
                              className="text-purple-600 border-purple-300 hover:bg-purple-50"
                            >
                              Selectivo
                            </Button>
                          </>
                        ) : payment.status === 'applied' && payment.applied_amount > 0 ? (
                          <span className="text-sm text-muted-foreground">Aplicado</span>
                        ) : null}
                        
                        {/* Botón Ver Detalle */}
                        {payment.applied_amount > 0 && (
                          <Button
                            onClick={() => {
                              setSelectedPaymentForDetail(payment);
                              setShowPaymentDetail(true);
                            }}
                            size="sm"
                            variant="ghost"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Detalle
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modales */}
      {showPaymentForm && (
        <SmartPaymentForm
          onClose={() => {
            setShowPaymentForm(false);
            refetch();
          }}
          onPaymentCreated={(paymentId, clientId) => {
            setShowPaymentForm(false);
            setSelectedClient(clientId);
            refetch();
            toast.success('Pago registrado. Ahora puede aplicarlo manualmente desde esta vista.', {
              duration: 5000,
            });
          }}
        />
      )}

      {showApplicationModal && selectedPayment && (
        <PaymentApplicationModal
          payment={selectedPayment}
          availableInvoices={availableInvoices}
          onClose={() => {
            setShowApplicationModal(false);
            refetch();
          }}
        />
      )}

      {showHistory && (
        <PaymentHistory
          onClose={() => setShowHistory(false)}
        />
      )}

      {selectivePaymentModalOpen && selectedPayment && (
        <SelectivePaymentModal
          payment={selectedPayment}
          isOpen={selectivePaymentModalOpen}
          onClose={() => {
            setSelectivePaymentModalOpen(false);
            setSelectedPayment(null);
          }}
          onApply={handleSelectiveApplication}
        />
      )}

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