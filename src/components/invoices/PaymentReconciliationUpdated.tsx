import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePayments } from '@/hooks/usePayments';
import { useClients } from '@/hooks/useClients';
import { PaymentWithDetails } from '@/types/payments';
import { PaymentApplicationModal } from './PaymentApplicationModal';
import { SystemHealthIndicator } from './SystemHealthIndicator';
import { toast } from 'sonner';
import { 
  Coins, 
  RefreshCw, 
  Plus, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  History,
  FileText,
  Settings,
  Wrench,
  ChevronDown,
  Zap,
  Edit,
  DollarSign
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface PaymentReconciliationProps {
  onClose?: () => void;
}

export const PaymentReconciliation: React.FC<PaymentReconciliationProps> = ({ onClose }) => {
  const { 
    payments, 
    loading, 
    paymentSystemAvailable, 
    applyPaymentFIFO, 
    getUnpaidInvoicesForClient,
    cleanupDuplicatePayments,
    syncPaidInvoicesWithPayments,
    getReconciliationStats,
    fixPaymentInconsistencies,
    validateSystemIntegrity,
    performBackgroundMaintenance,
    refetch
  } = usePayments();

  const { clients } = useClients();

  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithDetails | null>(null);
  const [availableInvoices, setAvailableInvoices] = useState<any[]>([]);
  const [reconciliationStats, setReconciliationStats] = useState<any>(null);
  const [systemDiagnosis, setSystemDiagnosis] = useState<any>(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [showMaintenancePanel, setShowMaintenancePanel] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (paymentSystemAvailable) {
      loadReconciliationStats();
      loadSystemDiagnosis();
      performAutomaticMaintenance();
    }
  }, [paymentSystemAvailable]);

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
      // Implementar función de diagnóstico cuando esté disponible
      const diagnosis = {
        system_health: 'HEALTHY',
        issues: {},
        total_issues: 0,
        timestamp: new Date().toISOString()
      };
      setSystemDiagnosis(diagnosis);
    } catch (error) {
      console.error('Error loading system diagnosis:', error);
    } finally {
      setDiagnosisLoading(false);
    }
  };

  const performAutomaticMaintenance = async () => {
    try {
      await performBackgroundMaintenance();
      await loadReconciliationStats();
      await loadSystemDiagnosis();
    } catch (error) {
      console.error('Error in automatic maintenance:', error);
    }
  };

  const handleAutoApply = async (payment: PaymentWithDetails) => {
    try {
      setIsProcessing(true);
      await applyPaymentFIFO(payment.id, payment.client_id);
      await loadReconciliationStats();
      await loadSystemDiagnosis();
      toast.success("Pago aplicado automáticamente");
    } catch (error) {
      console.error('Error applying payment:', error);
      toast.error("Error al aplicar el pago");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualApplication = async (payment: PaymentWithDetails) => {
    const invoices = await getUnpaidInvoicesForClient(payment.client_id);
    setAvailableInvoices(invoices);
    setSelectedPayment(payment);
    setShowPaymentModal(true);
  };

  const handleRefresh = async () => {
    setIsProcessing(true);
    try {
      await refetch();
      await loadReconciliationStats();
      await loadSystemDiagnosis();
      toast.success("Datos actualizados");
    } catch (error) {
      toast.error("Error al actualizar datos");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSystemRepair = async () => {
    setDiagnosisLoading(true);
    try {
      // Ejecutar correcciones en paralelo
      await Promise.all([
        fixPaymentInconsistencies(),
        cleanupDuplicatePayments(),
        syncPaidInvoicesWithPayments()
      ]);
      
      await loadSystemDiagnosis();
      await refetch();
      toast.success("Sistema reparado exitosamente");
    } catch (error) {
      console.error('Error repairing system:', error);
      toast.error("Error al reparar el sistema");
    } finally {
      setDiagnosisLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
      pending: 'secondary',
      applied: 'default',
      partial: 'secondary',
      cancelled: 'destructive'
    };
    
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      applied: 'bg-green-100 text-green-800',
      partial: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800'
    };

    return (
      <Badge variant={variants[status] || 'secondary'} 
             className={colors[status as keyof typeof colors] || ''}>
        {status}
      </Badge>
    );
  };

  if (!paymentSystemAvailable) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Sistema de conciliación no disponible. Contacte al administrador.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const filteredPayments = selectedClient && selectedClient !== 'all'
    ? payments.filter(p => p.client_id === selectedClient)
    : payments;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Conciliación de Pagos</h2>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isProcessing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button onClick={() => setShowPaymentForm(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Registrar Pago
          </Button>
          <Button onClick={() => setShowPaymentHistory(true)} variant="outline" size="sm">
            <History className="h-4 w-4 mr-2" />
            Ver Historial
          </Button>
        </div>
      </div>

      {/* Indicador de salud del sistema */}
      <div className="mb-6">
        <SystemHealthIndicator 
          diagnosis={systemDiagnosis || { system_health: 'UNKNOWN', issues: {}, total_issues: 0 }}
          loading={diagnosisLoading}
        />
      </div>

      {/* Panel de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Pendientes</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reconciliationStats?.pending_payments || 0}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(reconciliationStats?.total_pending_amount || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Aplicados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reconciliationStats?.applied_payments || 0}</div>
            <p className="text-xs text-muted-foreground">Completamente procesados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Facturas sin Pago</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reconciliationStats?.invoices_without_payments || 0}</div>
            <p className="text-xs text-muted-foreground">Marcadas como pagadas sin registro</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos sin Aplicar</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reconciliationStats?.payments_without_applications || 0}</div>
            <p className="text-xs text-muted-foreground">Pendientes de aplicar</p>
          </CardContent>
        </Card>
      </div>

      {/* Panel de herramientas de mantenimiento */}
      <Collapsible open={showMaintenancePanel} onOpenChange={setShowMaintenancePanel} className="mb-6">
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Herramientas de Mantenimiento
              {systemDiagnosis?.system_health === 'NEEDS_REPAIR' && (
                <Badge variant="destructive" className="ml-2">
                  Atención Requerida
                </Badge>
              )}
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Acciones de Corrección</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Corrección principal */}
                <Card className="border-primary bg-primary/5">
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-2">Corrección Automática</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Ejecuta todas las correcciones necesarias automáticamente
                    </p>
                    <Button 
                      onClick={handleSystemRepair}
                      disabled={diagnosisLoading || isProcessing}
                      className="w-full"
                    >
                      <Wrench className="h-4 w-4 mr-2" />
                      Reparar Sistema
                    </Button>
                  </CardContent>
                </Card>

                {/* Acciones individuales */}
                <div className="space-y-3">
                  <Button 
                    onClick={async () => {
                      await syncPaidInvoicesWithPayments();
                      await loadReconciliationStats();
                      await loadSystemDiagnosis();
                      toast.success("Sincronización completada");
                    }}
                    variant="outline" 
                    size="sm"
                    className="w-full justify-start"
                    disabled={isProcessing}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Sincronizar Facturas Pagadas
                  </Button>
                  
                  <Button 
                    onClick={async () => {
                      await cleanupDuplicatePayments();
                      await loadSystemDiagnosis();
                      toast.success("Duplicados eliminados");
                    }}
                    variant="outline" 
                    size="sm"
                    className="w-full justify-start"
                    disabled={isProcessing}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Eliminar Duplicados
                  </Button>
                  
                  <Button 
                    onClick={async () => {
                      await fixPaymentInconsistencies();
                      await loadSystemDiagnosis();
                      toast.success("Inconsistencias corregidas");
                    }}
                    variant="outline" 
                    size="sm"
                    className="w-full justify-start"
                    disabled={isProcessing}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Corregir Inconsistencias
                  </Button>
                  
                  <Button 
                    onClick={async () => {
                      await loadSystemDiagnosis();
                      toast.success("Diagnóstico actualizado");
                    }}
                    variant="outline" 
                    size="sm"
                    className="w-full justify-start"
                    disabled={diagnosisLoading}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Actualizar Diagnóstico
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Filtros */}
      <div className="flex gap-4 mb-6">
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Filtrar por cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map(client => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}{client.department ? ` - ${client.department}` : ''}
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
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4">
                    Cargando pagos...
                  </TableCell>
                </TableRow>
              ) : filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4">
                    No hay pagos registrados
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map(payment => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.client?.name || 'Cliente no encontrado'}</TableCell>
                    <TableCell>{formatCurrency(payment.amount)}</TableCell>
                    <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell>{formatCurrency(payment.applied_amount)}</TableCell>
                    <TableCell>{formatCurrency(payment.remaining_amount)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {payment.remaining_amount > 0 && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleAutoApply(payment)}
                              disabled={isProcessing}
                            >
                              <Zap className="h-3 w-3 mr-1" />
                              Auto
                            </Button>
                            <Button
                              type="button"
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modales */}
      {showPaymentModal && selectedPayment && (
        <PaymentApplicationModal
          payment={selectedPayment}
          availableInvoices={availableInvoices}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedPayment(null);
            loadReconciliationStats();
            loadSystemDiagnosis();
          }}
        />
      )}
    </div>
  );
};