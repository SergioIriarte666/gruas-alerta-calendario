import { parseDateValue } from '@/utils/calendarDate';
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CustomTabs, CustomTabsList, CustomTabsTrigger, CustomTabsContent } from '@/components/ui/custom-tabs';
import { Users, DollarSign, TrendingUp, Clock, RefreshCw, Percent } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCommissions, validateCommissionsAgainstCosts } from '@/hooks/commissions/useCommissions';
import { useCreatePaymentBatch } from '@/hooks/commissions/usePaymentBatches';
import { CreatePaymentBatchDialog } from '@/components/commissions/CreatePaymentBatchDialog';
import { CommissionExportButton } from '@/components/commissions/CommissionExportButton';
import { CommissionFiltersComponent } from '@/components/commissions/CommissionFilters';
import { CommissionTable, SortField, SortDirection } from '@/components/commissions/CommissionTable';
import { EditPaymentDateDialog } from '@/components/commissions/EditPaymentDateDialog';
import { ComisionManualForm } from '@/components/commissions/ComisionManualForm';
import { useUser } from '@/contexts/UserContext';

import { Commission, CommissionFilters } from '@/types/commissions';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/components/ui/custom-toast';
import { useQueryClient } from '@tanstack/react-query';
import { createLogger } from "@/lib/logger";


const logger = createLogger("Commissions");
const Commissions = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCommissions, setSelectedCommissions] = useState<string[]>([]);
  const [selectedOperatorCommissions, setSelectedOperatorCommissions] = useState<Record<string, string[]>>({});
  const [filters, setFilters] = useState<CommissionFilters>({
    status: 'all',
    operator_id: undefined,
    client_name: undefined,
    date_from: undefined,
    date_to: undefined,
    amount_from: undefined,
    amount_to: undefined,
  });
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  
  const { data: commissions, isLoading, isFetching, isError, error, refetch } = useCommissions();
  const createPaymentBatch = useCreatePaymentBatch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isError && error) {
      toast({
        type: 'error',
        title: 'No se pudieron cargar comisiones',
        description: error.message,
        priority: 'high',
      });
    }
  }, [isError, error?.message, toast]);

  // Cache is managed by React Query staleTime — no forced invalidation on mount

  // Función para forzar actualización de datos
  const handleRefreshData = async () => {
    queryClient.invalidateQueries({ queryKey: ['commissions'] });
    queryClient.invalidateQueries({ queryKey: ['costs'] });
    const result = await refetch();

    if (result.data) {
      try {
        const validation = await validateCommissionsAgainstCosts(result.data);
        if (validation.missingIds.length > 0) {
          toast({
            type: 'warning',
            title: 'Validación de comisiones',
            description: `Faltan ${validation.missingIds.length} comisiones por mostrar (esperadas: ${validation.expectedTotal}, visibles: ${validation.actualTotal}).`,
            priority: 'high',
          });
        } else {
          toast({
            type: 'success',
            title: 'Validación de comisiones',
            description: `Todas las comisiones aparecen correctamente (total: ${validation.actualTotal}).`,
            priority: 'low',
          });
        }
      } catch (e: any) {
        toast({
          type: 'error',
          title: 'Validación de comisiones',
          description: e?.message || 'Error validando consistencia de comisiones',
          priority: 'high',
        });
      }
    }
  };

  // Sorting logic
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortCommissions = (commissions: Commission[]) => {
    if (!sortField || !sortDirection) return commissions;

    return [...commissions].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'folio':
          aValue = a.service_folio || '';
          bValue = b.service_folio || '';
          break;
        case 'service_date':
          aValue = parseDateValue(a.services?.service_date || a.date);
          bValue = parseDateValue(b.services?.service_date || b.date);
          break;
        case 'client_name':
          aValue = a.client_name || '';
          bValue = b.client_name || '';
          break;
        case 'operator_name':
          aValue = a.operators?.name || '';
          bValue = b.operators?.name || '';
          break;
        case 'service_value':
          aValue = a.service_value || 0;
          bValue = b.service_value || 0;
          break;
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'commission_percentage':
          aValue = a.commission_percentage || 0;
          bValue = b.commission_percentage || 0;
          break;
        case 'created_at':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        case 'payment_date':
          aValue = a.payment_date ? parseDateValue(a.payment_date) : new Date(0); // Sin fecha de pago al final
          bValue = b.payment_date ? parseDateValue(b.payment_date) : new Date(0);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Filter commissions based on search term and filters
  const baseFilteredCommissions = useMemo(() => {
    if (!commissions) return [];
    
    logger.debug('🔍 [Commissions] Filtering commissions:', {
      total: commissions.length,
      searchTerm,
      filters,
      sampleCommission: commissions[0]
    });
    
    const filtered = commissions.filter(commission => {
      // Search term filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = searchTerm === '' || (
        commission.operators?.name?.toLowerCase().includes(searchLower) ||
        commission.service_folio?.toLowerCase().includes(searchLower) ||
        commission.description.toLowerCase().includes(searchLower) ||
        commission.client_name?.toLowerCase().includes(searchLower)
      );

      // Status filter
      const matchesStatus = filters.status === 'all' || commission.status === filters.status;

      // Operator filter
      const matchesOperator = !filters.operator_id || commission.operator_id === filters.operator_id;

      // Client filter
      const matchesClient = !filters.client_name || 
        commission.client_name?.toLowerCase().includes(filters.client_name.toLowerCase());

      // Amount filter
      const matchesAmountFrom = !filters.amount_from || commission.amount >= filters.amount_from;
      const matchesAmountTo = !filters.amount_to || commission.amount <= filters.amount_to;

      // Date filter
      const commissionDate = parseDateValue(commission.services?.service_date || commission.date);
      const matchesDateFrom = !filters.date_from || commissionDate >= filters.date_from;
      const matchesDateTo = !filters.date_to || commissionDate <= filters.date_to;

      const passes = matchesSearch && matchesStatus && matchesOperator && matchesClient && 
             matchesAmountFrom && matchesAmountTo && matchesDateFrom && matchesDateTo;

      return passes;
    });

    logger.debug('✅ [Commissions] Filtered results:', {
      filtered: filtered.length,
      total: commissions.length
    });

    return filtered;
  }, [commissions, searchTerm, filters]);

  // Apply sorting to filtered commissions
  const filteredCommissions = useMemo(() => {
    return sortCommissions(baseFilteredCommissions);
  }, [baseFilteredCommissions, sortField, sortDirection]);

  // Group commissions by operator with status separation
  const commissionsByOperator = useMemo(() => {
    const grouped = filteredCommissions.reduce((acc, commission) => {
      const operatorId = commission.operator_id;
      const operatorName = commission.operators?.name || 'Operador desconocido';
      
      if (!acc[operatorId]) {
        acc[operatorId] = {
          operator: { id: operatorId, name: operatorName },
          commissions: [],
          totalPending: 0,
          totalPaid: 0,
          countPending: 0,
          countPaid: 0
        };
      }
      
      acc[operatorId].commissions.push(commission);
      
      if (commission.status === 'pending') {
        acc[operatorId].totalPending += commission.amount;
        acc[operatorId].countPending += 1;
      } else {
        acc[operatorId].totalPaid += commission.amount;
        acc[operatorId].countPaid += 1;
      }
      
      return acc;
    }, {} as Record<string, { 
      operator: { id: string, name: string }, 
      commissions: Commission[], 
      totalPending: number,
      totalPaid: number,
      countPending: number,
      countPaid: number
    }>);
    
    return Object.values(grouped);
  }, [filteredCommissions]);

  // Statistics
  const pendingCommissions = filteredCommissions.filter(c => c.status === 'pending');
  const paidCommissions = filteredCommissions.filter(c => c.status === 'paid');
  const totalPending = pendingCommissions.reduce((sum, commission) => sum + commission.amount, 0);
  const totalPaid = paidCommissions.reduce((sum, commission) => sum + commission.amount, 0);

  // Get unique operators for filters
  const uniqueOperators = useMemo(() => {
    if (!commissions) return [];
    const operatorMap = new Map();
    commissions.forEach(commission => {
      if (commission.operators) {
        operatorMap.set(commission.operators.id, commission.operators);
      }
    });
    return Array.from(operatorMap.values());
  }, [commissions]);

  const toggleCommissionSelection = (commissionId: string) => {
    const commission = filteredCommissions.find(c => c.id === commissionId);
    if (commission?.status === 'paid') return; // Don't allow selection of paid commissions

    const isSelecting = !selectedCommissions.includes(commissionId);
    if (isSelecting && selectedCommissions.length > 0) {
      const firstSelected = filteredCommissions.find(c => c.id === selectedCommissions[0]);
      const selectedOperatorId = firstSelected?.operator_id;
      if (selectedOperatorId && commission?.operator_id && selectedOperatorId !== commission.operator_id) {
        toast({
          type: "error",
          title: "Selección inválida",
          description: "Solo puedes seleccionar comisiones de un operador por lote.",
        });
        return;
      }
    }
    
    setSelectedCommissions(prev => 
      prev.includes(commissionId) 
        ? prev.filter(id => id !== commissionId)
        : [...prev, commissionId]
    );
  };

  const toggleOperatorCommissionSelection = (operatorId: string, commissionId: string) => {
    const commission = filteredCommissions.find(c => c.id === commissionId);
    if (commission?.status === 'paid') return; // Don't allow selection of paid commissions
    
    setSelectedOperatorCommissions(prev => ({
      ...prev,
      [operatorId]: prev[operatorId]?.includes(commissionId)
        ? prev[operatorId].filter(id => id !== commissionId)
        : [...(prev[operatorId] || []), commissionId]
    }));
  };

  const selectAllOperatorCommissions = (operatorId: string, commissions: Commission[]) => {
    const pendingCommissionIds = commissions.filter(c => c.status === 'pending').map(c => c.id);
    setSelectedOperatorCommissions(prev => ({
      ...prev,
      [operatorId]: pendingCommissionIds
    }));
  };

  const clearOperatorSelection = (operatorId: string) => {
    setSelectedOperatorCommissions(prev => ({
      ...prev,
      [operatorId]: []
    }));
  };

  const handleCreatePaymentBatch = async (batchData: any) => {
    try {
      logger.debug('📦 [Commissions] Creando lote de pago:', batchData);
      await createPaymentBatch.mutateAsync(batchData);
      toast({
        type: "success",
        title: "Lote de pago creado",
        description: "Las comisiones han sido marcadas como pagadas.",
      });
      // Clear selections
      setSelectedCommissions([]);
      setSelectedOperatorCommissions({});
    } catch (error: any) {
      logger.error('❌ [Commissions] Error creando lote:', error);
      const errorMessage = error?.message || "No se pudo crear el lote de pago.";
      toast({
        type: "error",
        title: "Error al crear lote",
        description: errorMessage,
      });
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className={`commissions-concept pb-6 ${isMobile ? 'space-y-3' : 'space-y-6'}`}>
      <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-end justify-between'}`}>
        <div>
          <span className="dashboard-section-kicker"><Percent className="size-3.5" />Liquidación operativa</span>
          <h1 className="dashboard-section-title">Comisiones</h1>
          <p className="dashboard-section-description">Cálculo, validación y pago de comisiones por operador.</p>
        </div>
      </div>

      {isError && (
        <Card className="border-danger/40 bg-danger-soft">
          <CardContent className="py-4">
            <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between'} gap-3`}>
              <div className="text-sm">
                <div className="font-semibold">Error cargando comisiones</div>
                <div className="text-muted-foreground break-words">{error?.message}</div>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefreshData} disabled={isFetching}>
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-1 md:grid-cols-4 gap-6'} mb-8`}>
        <Card className="dashboard-kpi dashboard-kpi--primary">
          <span className="dashboard-kpi__accent" aria-hidden="true" />
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendiente</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>
              {new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0,
              }).format(totalPending)}
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingCommissions.length} pendientes
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-kpi" data-tone="success">
          <span className="dashboard-kpi__accent" aria-hidden="true" />
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pagado</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>
              {new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0,
              }).format(totalPaid)}
            </div>
            <p className="text-xs text-muted-foreground">
              {paidCommissions.length} pagadas
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-kpi" data-tone="info">
          <span className="dashboard-kpi__accent" aria-hidden="true" />
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operadores</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>{commissionsByOperator.length}</div>
            <p className="text-xs text-muted-foreground">
              Con comisiones
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-kpi" data-tone="warning">
          <span className="dashboard-kpi__accent" aria-hidden="true" />
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total General</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>
              {new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0,
              }).format(totalPending + totalPaid)}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredCommissions.length} totales
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="finance-filter-panel flex flex-col gap-4 p-4 mb-6">
        <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between'}`}>
          <Input
            placeholder="Buscar por operador, folio, cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={isMobile ? 'w-full' : 'max-w-md'}
          />
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshData}
              disabled={isFetching}
            >
              <RefreshCw className={`size-4 ${isMobile ? '' : 'mr-2'} ${isFetching ? 'animate-spin' : ''}`} />
              {!isMobile && 'Actualizar'}
            </Button>
            
            <CommissionExportButton
              commissions={filteredCommissions}
              filters={filters}
              size="sm"
            />
          </div>
        </div>
        
        <CommissionFiltersComponent
          filters={filters}
          onFiltersChange={setFilters}
          operators={uniqueOperators}
        />
      </div>

      <CustomTabs value={activeTab} onValueChange={setActiveTab}>
        <CustomTabsList className="finance-tabs">
          <CustomTabsTrigger value="all">Todas las Comisiones</CustomTabsTrigger>
          <CustomTabsTrigger value="by-operator">Por Operador</CustomTabsTrigger>
        </CustomTabsList>

        <CustomTabsContent value="all">
          <Card className="finance-panel">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Todas las Comisiones</CardTitle>
               <div className="flex items-center gap-2">
                {isAdmin && <ComisionManualForm />}
                <CommissionExportButton
                  commissions={filteredCommissions}
                  filters={filters}
                  size="sm"
                  variant="outline"
                />
                {selectedCommissions.length > 0 && (
                  <>
                    {/* Botón para crear lote de pago - solo comisiones pendientes */}
                    {filteredCommissions.filter(c => 
                      c.status === 'pending' && selectedCommissions.includes(c.id)
                    ).length > 0 && (
                      <CreatePaymentBatchDialog
                        selectedCommissions={selectedCommissions}
                        commissions={filteredCommissions.filter(c => c.status === 'pending')}
                        onSuccess={handleCreatePaymentBatch}
                        trigger={
                          <Button>
                            Crear Lote de Pago ({filteredCommissions.filter(c => 
                              c.status === 'pending' && selectedCommissions.includes(c.id)
                            ).length})
                          </Button>
                        }
                      />
                    )}
                    
                    {/* Botón para editar fechas de pago - solo comisiones pagadas */}
                    {filteredCommissions.filter(c => 
                      c.status === 'paid' && selectedCommissions.includes(c.id)
                    ).length > 0 && (
                      <EditPaymentDateDialog
                        commissions={filteredCommissions.filter(c => 
                          c.status === 'paid' && selectedCommissions.includes(c.id)
                        )}
                        onSuccess={() => {
                          queryClient.invalidateQueries({ queryKey: ['commissions'] });
                          setSelectedCommissions([]);
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredCommissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No se encontraron comisiones
                </div>
              ) : (
                <CommissionTable
                  commissions={filteredCommissions}
                  selectedCommissions={selectedCommissions}
                  onToggleCommission={toggleCommissionSelection}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  onPaymentDateUpdated={() => queryClient.invalidateQueries({ queryKey: ['commissions'] })}
                />
              )}
            </CardContent>
          </Card>
        </CustomTabsContent>

        <CustomTabsContent value="by-operator">
          <div className="space-y-6">
            {commissionsByOperator.map((operatorGroup) => {
              const pendingCommissions = operatorGroup.commissions.filter(c => c.status === 'pending');
              
              return (
                <Card key={operatorGroup.operator.id} className="finance-panel">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>{operatorGroup.operator.name}</CardTitle>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          Pendientes: {operatorGroup.countPending} • {' '}
                          {new Intl.NumberFormat('es-CL', {
                            style: 'currency',
                            currency: 'CLP',
                            minimumFractionDigits: 0,
                          }).format(operatorGroup.totalPending)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Pagadas: {operatorGroup.countPaid} • {' '}
                          {new Intl.NumberFormat('es-CL', {
                            style: 'currency',
                            currency: 'CLP',
                            minimumFractionDigits: 0,
                          }).format(operatorGroup.totalPaid)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-x-2">
                      <CommissionExportButton
                        commissions={operatorGroup.commissions}
                        filters={{
                          ...filters,
                          operator_id: operatorGroup.operator.id
                        }}
                        size="sm"
                        variant="ghost"
                      />
                      {selectedOperatorCommissions[operatorGroup.operator.id]?.length > 0 && (
                        <CreatePaymentBatchDialog
                          selectedCommissions={selectedOperatorCommissions[operatorGroup.operator.id]}
                          commissions={pendingCommissions}
                          onSuccess={handleCreatePaymentBatch}
                          trigger={
                            <Button size="sm">
                              Crear Lote ({selectedOperatorCommissions[operatorGroup.operator.id].length})
                            </Button>
                          }
                        />
                      )}
                      {pendingCommissions.length > 0 && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectAllOperatorCommissions(operatorGroup.operator.id, pendingCommissions)}
                          >
                            Seleccionar Pendientes
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => clearOperatorSelection(operatorGroup.operator.id)}
                          >
                            Limpiar
                          </Button>
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CommissionTable
                      commissions={operatorGroup.commissions}
                      selectedCommissions={selectedOperatorCommissions[operatorGroup.operator.id] || []}
                      onToggleCommission={(commissionId) => toggleOperatorCommissionSelection(operatorGroup.operator.id, commissionId)}
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      onPaymentDateUpdated={() => queryClient.invalidateQueries({ queryKey: ['commissions'] })}
                    />
                  </CardContent>
                </Card>
              );
            })}

            {commissionsByOperator.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron operadores con comisiones
              </div>
            )}
          </div>
        </CustomTabsContent>
      </CustomTabs>
    </div>
  );
};

export default Commissions;
