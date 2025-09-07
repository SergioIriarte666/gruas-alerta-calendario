import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CustomTabs, CustomTabsList, CustomTabsTrigger, CustomTabsContent } from '@/components/ui/custom-tabs';
import { Users, DollarSign, TrendingUp, Clock, RefreshCw } from 'lucide-react';
import { useCommissions } from '@/hooks/commissions/useCommissions';
import { useCreatePaymentBatch } from '@/hooks/commissions/usePaymentBatches';
import { CreatePaymentBatchDialog } from '@/components/commissions/CreatePaymentBatchDialog';
import { CommissionExportButton } from '@/components/commissions/CommissionExportButton';
import { CommissionFiltersComponent } from '@/components/commissions/CommissionFilters';
import { CommissionTable, SortField, SortDirection } from '@/components/commissions/CommissionTable';
import { EditPaymentDateDialog } from '@/components/commissions/EditPaymentDateDialog';
import { Commission, CommissionFilters } from '@/types/commissions';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/components/ui/custom-toast';
import { useQueryClient } from '@tanstack/react-query';

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
  
  const { data: commissions, isLoading, refetch } = useCommissions();
  const createPaymentBatch = useCreatePaymentBatch();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Forzar invalidación automática al cargar la página
  useEffect(() => {
    const forceRefresh = async () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
    };
    
    forceRefresh();
  }, []); // Solo se ejecuta al montar el componente

  // Función para forzar actualización de datos
  const handleRefreshData = async () => {
    queryClient.invalidateQueries({ queryKey: ['commissions'] });
    queryClient.invalidateQueries({ queryKey: ['costs'] });
    await refetch();
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
          aValue = new Date(a.services?.service_date || a.date);
          bValue = new Date(b.services?.service_date || b.date);
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
          aValue = a.payment_date ? new Date(a.payment_date) : new Date(0); // Sin fecha de pago al final
          bValue = b.payment_date ? new Date(b.payment_date) : new Date(0);
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
    
    console.log('🔍 [Commissions] Filtering commissions:', {
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
      const commissionDate = new Date(commission.services?.service_date || commission.date);
      const matchesDateFrom = !filters.date_from || commissionDate >= filters.date_from;
      const matchesDateTo = !filters.date_to || commissionDate <= filters.date_to;

      const passes = matchesSearch && matchesStatus && matchesOperator && matchesClient && 
             matchesAmountFrom && matchesAmountTo && matchesDateFrom && matchesDateTo;

      return passes;
    });

    console.log('✅ [Commissions] Filtered results:', {
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
      await createPaymentBatch.mutateAsync(batchData);
      toast({
        type: "success",
        title: "Lote de pago creado",
        description: "Las comisiones han sido marcadas como pagadas.",
      });
      // Clear selections
      setSelectedCommissions([]);
      setSelectedOperatorCommissions({});
    } catch (error) {
      toast({
        type: "error",
        title: "Error",
        description: "No se pudo crear el lote de pago.",
      });
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Comisiones</h1>
          <p className="text-muted-foreground">
            Gestiona las comisiones de los operadores
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendiente</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0,
              }).format(totalPending)}
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingCommissions.length} comisiones pendientes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pagado</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0,
              }).format(totalPaid)}
            </div>
            <p className="text-xs text-muted-foreground">
              {paidCommissions.length} comisiones pagadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operadores Activos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{commissionsByOperator.length}</div>
            <p className="text-xs text-muted-foreground">
              Con comisiones registradas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total General</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0,
              }).format(totalPending + totalPaid)}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredCommissions.length} comisiones totales
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <Input
            placeholder="Buscar por operador, folio, cliente o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshData}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
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
        <CustomTabsList>
          <CustomTabsTrigger value="all">Todas las Comisiones</CustomTabsTrigger>
          <CustomTabsTrigger value="by-operator">Por Operador</CustomTabsTrigger>
        </CustomTabsList>

        <CustomTabsContent value="all">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Todas las Comisiones</CardTitle>
               <div className="flex items-center gap-2">
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
                <Card key={operatorGroup.operator.id}>
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
                    <div className="flex items-center space-x-2">
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