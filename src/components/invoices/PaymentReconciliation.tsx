import React, { useState, useEffect, useMemo } from 'react';
import { usePayments } from '@/hooks/usePayments';
import { useClients } from '@/hooks/useClients';
import { PaymentWithDetails } from '@/types/payments';
import { PaymentApplicationModal } from './PaymentApplicationModal';
import { SmartPaymentForm } from './SmartPaymentForm';
import { PaymentHistory } from './PaymentHistory';
import { SelectivePaymentModal } from './SelectivePaymentModal';
import { PaymentReconciliationHeader } from './PaymentReconciliationHeader';
import { PaymentMetricsCards } from './PaymentMetricsCards';
import { PaymentQuickFilters, PaymentDateFilter } from './PaymentQuickFilters';
import { PaymentStatusFilters, PaymentStatusFilter } from './PaymentStatusFilters';
import { PaymentCardsView } from './PaymentCardsView';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Edit, AlertTriangle, Eye, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { PaymentApplicationsDetailModal } from './PaymentApplicationsDetailModal';
import { startOfDay, startOfWeek, startOfMonth, isAfter } from 'date-fns';

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
    refetch,
  } = usePayments();
  
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithDetails | null>(null);
  const [availableInvoices, setAvailableInvoices] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectivePaymentModalOpen, setSelectivePaymentModalOpen] = useState(false);
  const [showPaymentDetail, setShowPaymentDetail] = useState(false);
  const [selectedPaymentForDetail, setSelectedPaymentForDetail] = useState<PaymentWithDetails | null>(null);
  
  // New state for redesign
  const [dateFilter, setDateFilter] = useState<PaymentDateFilter>('all');
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showSensitiveData, setShowSensitiveData] = useState(() => {
    const stored = localStorage.getItem('paymentReconciliation_showSensitiveData');
    return stored !== null ? stored === 'true' : true;
  });

  const { clients } = useClients();

  // Persist sensitive data preference
  useEffect(() => {
    localStorage.setItem('paymentReconciliation_showSensitiveData', String(showSensitiveData));
  }, [showSensitiveData]);

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

  const openSelectiveModal = (payment: PaymentWithDetails) => {
    setSelectedPayment(payment);
    setSelectivePaymentModalOpen(true);
  };

  const openDetailModal = (payment: PaymentWithDetails) => {
    setSelectedPaymentForDetail(payment);
    setShowPaymentDetail(true);
  };

  // Filter payments by date
  const getDateFilteredPayments = (payments: PaymentWithDetails[]) => {
    if (dateFilter === 'all') return payments;
    
    const now = new Date();
    let startDate: Date;
    
    switch (dateFilter) {
      case 'today':
        startDate = startOfDay(now);
        break;
      case 'week':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'month':
        startDate = startOfMonth(now);
        break;
      default:
        return payments;
    }
    
    return payments.filter(payment => {
      const paymentDate = new Date(payment.payment_date);
      return isAfter(paymentDate, startDate) || paymentDate.getTime() === startDate.getTime();
    });
  };

  // Filter payments by status
  const getStatusFilteredPayments = (payments: PaymentWithDetails[]) => {
    if (statusFilter === 'all') return payments;
    return payments.filter(payment => payment.status === statusFilter);
  };

  // Filter payments by client
  const getClientFilteredPayments = (payments: PaymentWithDetails[]) => {
    if (selectedClient === 'all') return payments;
    return payments.filter(payment => payment.client_id === selectedClient);
  };

  // Apply all filters
  const filteredPayments = useMemo(() => {
    let result = payments;
    result = getDateFilteredPayments(result);
    result = getStatusFilteredPayments(result);
    result = getClientFilteredPayments(result);
    return result;
  }, [payments, dateFilter, statusFilter, selectedClient]);

  // Calculate status counts for filters
  const statusCounts = useMemo(() => {
    const dateFiltered = getDateFilteredPayments(getClientFilteredPayments(payments));
    return {
      pending: dateFiltered.filter(p => p.status === 'pending').length,
      partial: dateFiltered.filter(p => p.status === 'partial').length,
      applied: dateFiltered.filter(p => p.status === 'applied').length,
    };
  }, [payments, dateFilter, selectedClient]);

  const pendingCount = useMemo(() => {
    return payments.filter(p => p.status === 'pending').length;
  }, [payments]);

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

  const clearFilters = () => {
    setSelectedClient('all');
    setDateFilter('all');
    setStatusFilter('all');
  };

  const hasActiveFilters = selectedClient !== 'all' || dateFilter !== 'all' || statusFilter !== 'all';

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
      {/* Header */}
      <PaymentReconciliationHeader
        onRegisterPayment={() => setShowPaymentForm(true)}
        onShowHistory={() => setShowHistory(true)}
        onRefresh={refetch}
        isLoading={paymentsLoading}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        activeDateFilter={dateFilter}
        showSensitiveData={showSensitiveData}
        onToggleSensitiveData={() => setShowSensitiveData(!showSensitiveData)}
      />

      {/* Quick Date Filters */}
      <PaymentQuickFilters
        selected={dateFilter}
        onChange={setDateFilter}
        pendingCount={pendingCount}
      />

      {/* Status Filters */}
      <PaymentStatusFilters
        selected={statusFilter}
        onChange={setStatusFilter}
        counts={statusCounts}
      />

      {/* Metrics Cards */}
      <PaymentMetricsCards
        payments={filteredPayments}
        showSensitiveData={showSensitiveData}
      />

      {/* Client Filter & Clear Button */}
      <div className="flex gap-4 items-center">
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Filtrar por cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                <div className="flex flex-col py-0.5">
                  <span className="font-medium">{client.name}</span>
                  {client.department && client.department !== 'General' && (
                    <span className="text-xs text-violet-600 dark:text-violet-400">
                      {client.department}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Content: Table or Cards */}
      {viewMode === 'cards' ? (
        <PaymentCardsView
          payments={filteredPayments}
          onManualApplication={handleManualApplication}
          onSelectiveApplication={openSelectiveModal}
          onViewDetail={openDetailModal}
          showSensitiveData={showSensitiveData}
        />
      ) : (
        <Card>
          <CardHeader className="bg-gradient-to-r from-violet-600 to-violet-700 text-white rounded-t-lg">
            <CardTitle className="text-lg font-semibold">Pagos Registrados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {paymentsLoading ? (
              <div className="text-center py-8">Cargando pagos...</div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay pagos registrados
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Cliente</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => {
                    const progressPercent = payment.amount > 0 
                      ? (payment.applied_amount / payment.amount) * 100 
                      : 0;
                    
                    return (
                      <TableRow 
                        key={payment.id}
                        className="hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition-colors"
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium">{payment.client?.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {payment.bank_reference}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-violet-600">
                          {showSensitiveData ? formatCurrency(payment.amount) : '••••••'}
                        </TableCell>
                        <TableCell>
                          {new Date(payment.payment_date).toLocaleDateString('es-CL')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(payment.status)}>
                            {getStatusLabel(payment.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="w-32 space-y-1">
                            <Progress value={progressPercent} className="h-2" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{showSensitiveData ? formatCurrency(payment.applied_amount) : '••••'}</span>
                              <span>{Math.round(progressPercent)}%</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {(payment.status === 'pending' || payment.remaining_amount > 0) && (
                              <>
                                <Button
                                  onClick={() => handleManualApplication(payment)}
                                  size="sm"
                                  variant="default"
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Aplicar
                                </Button>
                                <Button
                                  onClick={() => openSelectiveModal(payment)}
                                  size="sm"
                                  variant="outline"
                                  className="text-violet-600 border-violet-300 hover:bg-violet-50"
                                >
                                  Selectivo
                                </Button>
                              </>
                            )}
                            
                            {payment.applied_amount > 0 && (
                              <Button
                                onClick={() => openDetailModal(payment)}
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
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modals */}
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
