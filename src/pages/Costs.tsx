import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CostList } from '@/components/costs/CostList';
import { EnhancedCostsTable } from '@/components/costs/EnhancedCostsTable';
import { CostForm } from '@/components/costs/CostForm';
import { QuickCostForm } from '@/components/costs/QuickCostForm';
import { ConsolidatedCostDetails } from '@/components/costs/ConsolidatedCostDetails';
import { XMLCostUpload } from '@/components/costs/XMLCostUpload';
import { CSVCostUpload } from '@/components/costs/CSVCostUpload';
import { CostFilters } from '@/components/costs/CostFilters';
import { UnifiedCostFilters } from '@/components/costs/UnifiedCostFilters';
import { CostsDashboard } from '@/components/costs/CostsDashboard';
import { CostBatchUpdateModal } from '@/components/costs/CostBatchUpdateModal';
import { DistributionAssistantDialog } from '@/components/costs/dialogs/DistributionAssistantDialog';
import { CostDeleteConfirmDialog } from '@/components/costs/CostDeleteConfirmDialog';
import { useCosts, useDeleteCost } from '@/hooks/useCosts';
import { useUniversalSync } from '@/hooks/useUniversalSync';
import { useQueryClient } from '@tanstack/react-query';
import { useDateFilters } from '@/hooks/useDateFilters';
import { Cost } from '@/types/costs';
import { prepareCostForDuplication } from '@/utils/costHelpers';
import { Skeleton } from '@/components/ui/skeleton';
import { Zap, FileEdit, FileSpreadsheet } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import * as XLSX from 'xlsx';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import { 
  getCurrentChileDate, 
  formatForDisplay,
  formatForDatabase,
  getCurrentWeekRange 
} from '@/utils/timezoneUtils';

const CostsPage = () => {
    const isMobile = useIsMobile();
    const [searchParams] = useSearchParams();
    const location = useLocation() as { state?: { prefilledData?: any } } | any;
    const navigate = useNavigate();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isQuickFormOpen, setIsQuickFormOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isXMLUploadOpen, setIsXMLUploadOpen] = useState(false);
    const [isCSVUploadOpen, setIsCSVUploadOpen] = useState(false);
    const [isBatchUpdateOpen, setIsBatchUpdateOpen] = useState(false);
    const [isBatchMarkPaidOpen, setIsBatchMarkPaidOpen] = useState(false);
    const [isDistributionOpen, setIsDistributionOpen] = useState(false);
    const [selectedCostForEdit, setSelectedCostForEdit] = useState<Cost | null>(null);
    const [prefilledDataForDuplication, setPrefilledDataForDuplication] = useState<ReturnType<typeof prepareCostForDuplication> | null>(null);
    const [selectedCostForDetails, setSelectedCostForDetails] = useState<Cost | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
    const [highlightedCostId, setHighlightedCostId] = useState<string>('');
    const [dateFilter, setDateFilter] = useState<string>('all');
    const [selectedCostIds, setSelectedCostIds] = useState<Set<string>>(new Set());
    const [showDashboard, setShowDashboard] = useState(true);
    const [distributionData, setDistributionData] = useState<{
        costId: string;
        itemName: string;
        totalQuantity: number;
        unitCost: number;
        date: string;
    } | null>(null);
    const [filters, setFilters] = useState<CostFilters>({
        category: 'all',
        subcategory: 'all',
        dateFrom: null,
        dateTo: null,
        operatorId: 'all',
        craneId: 'all',
        serviceId: '',
        minAmount: '',
        maxAmount: ''
    });
    
    const { data: costs = [], isLoading } = useCosts();
    const { mutate: deleteCost } = useDeleteCost();
    const { invalidateAll } = useUniversalSync();
    const dateMetrics = useDateFilters(costs);
    const queryClient = useQueryClient();
    const { user } = useUser();

    const baseCosts = costs;

    // Cache is managed by React Query staleTime — no forced invalidation on mount

    useEffect(() => {
        const statePrefill = (location?.state as any)?.prefilledData;
        if (!statePrefill) return;
        setPrefilledDataForDuplication(statePrefill);
        setIsFormOpen(true);
        navigate(location.pathname, { replace: true });
    }, [location?.state, location.pathname, navigate]);

    // Efecto para manejar el parámetro costId de la URL
    useEffect(() => {
        const costId = searchParams.get('costId');
        if (costId) {
            setHighlightedCostId(costId);
            setSearchTerm(`id:${costId}`);
        }
    }, [searchParams]);

    const handleOpenForm = useCallback((cost: Cost | null = null) => {
        if (cost?.payment_date && user?.role !== 'admin') {
            toast.error('Este costo está marcado como pagado y no puede ser modificado sin autorización especial');
            return;
        }
        setSelectedCostForEdit(cost);
        setIsFormOpen(true);
    }, [user]);

    const handleCloseForm = useCallback(() => {
        setIsFormOpen(false);
        setSelectedCostForEdit(null);
        setPrefilledDataForDuplication(null);
    }, []);

    const handleDuplicateCost = useCallback((cost: Cost) => {
        const duplicatedData = prepareCostForDuplication(cost);
        setPrefilledDataForDuplication(duplicatedData);
        setSelectedCostForEdit(null);
        setIsFormOpen(true);
    }, []);

    const handleInventoryCostCreated = useCallback((data: {
        costId: string;
        description: string;
        quantity: number;
        unitCost: number;
        date: string;
    }) => {
        setDistributionData({
            costId: data.costId,
            itemName: data.description,
            totalQuantity: data.quantity,
            unitCost: data.unitCost,
            date: data.date,
        });
        setIsDistributionOpen(true);
    }, []);

    const handleViewDetails = useCallback((cost: Cost) => {
        setSelectedCostForDetails(cost);
        setIsDetailsOpen(true);
    }, []);

    const handleCloseDetails = useCallback(() => {
        setSelectedCostForDetails(null);
        setIsDetailsOpen(false);
    }, []);

    const [costToDelete, setCostToDelete] = useState<Cost | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const handleDeleteCost = useCallback((cost: Cost) => {
        if (cost.payment_date && user?.role !== 'admin') {
            toast.error('Este costo está marcado como pagado y no puede ser modificado sin autorización especial');
            return;
        }
        setCostToDelete(cost);
        setIsDeleteDialogOpen(true);
    }, [user]);

    const handleConfirmDelete = useCallback((cost: Cost) => {
        deleteCost(cost.id);
        setCostToDelete(null);
    }, [deleteCost]);

    const handleClearFilters = useCallback(() => {
        setFilters({
            category: 'all',
            subcategory: 'all',
            dateFrom: null,
            dateTo: null,
            operatorId: 'all',
            craneId: 'all',
            serviceId: '',
            minAmount: '',
            maxAmount: ''
        });
    }, []);

    const handleOpenXMLUpload = useCallback(() => {
        setIsXMLUploadOpen(true);
    }, []);

    const handleCloseXMLUpload = useCallback(() => {
        setIsXMLUploadOpen(false);
    }, []);

    const handleXMLUploadSuccess = useCallback((count: number) => {
        setHighlightedCostId('');
    }, []);

    // Filtrar costos por fecha y término de búsqueda
    const filteredCostsByDate = useMemo(() => {
        let filtered = baseCosts;
        const today = new Date();

        switch (dateFilter) {
            case 'today':
                filtered = baseCosts.filter(cost => {
                    const costDate = new Date(cost.date + 'T00:00:00');
                    return costDate.toDateString() === today.toDateString();
                });
                break;
            case 'week': {
                const { start: weekStart, end: weekEnd } = getCurrentWeekRange();
                filtered = baseCosts.filter(cost => {
                    const costDate = new Date(cost.date + 'T00:00:00');
                    return costDate >= weekStart && costDate <= weekEnd;
                });
                break;
            }
            case 'month':
                filtered = baseCosts.filter(cost => {
                    const costDate = new Date(cost.date + 'T00:00:00');
                    return costDate.getMonth() === today.getMonth() && 
                           costDate.getFullYear() === today.getFullYear();
                });
                break;
            case 'all':
            default:
                filtered = baseCosts;
                break;
        }

        return filtered;
    }, [costs, dateFilter]);

    // Aplicar filtros adicionales
    const finalFilteredCosts = useMemo(() => {
        let filtered = filteredCostsByDate;

        if (searchTerm.startsWith('id:')) {
            const costId = searchTerm.substring(3);
            filtered = filtered.filter(cost => cost.id === costId);
        } else if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(cost => {
                const matchesCost = cost.description.toLowerCase().includes(searchLower) ||
                    cost.notes?.toLowerCase().includes(searchLower) ||
                    cost.cost_categories?.name.toLowerCase().includes(searchLower) ||
                    cost.subcategory?.toLowerCase().includes(searchLower) ||
                    (cost.service_folio && cost.service_folio.toLowerCase().includes(searchLower)) ||
                    (cost.services?.folio && cost.services.folio.toLowerCase().includes(searchLower));
                
                const matchesMaintenance = cost.crane_maintenance?.description?.toLowerCase().includes(searchLower) ||
                    cost.crane_maintenance?.provider?.toLowerCase().includes(searchLower) ||
                    cost.crane_maintenance?.maintenance_type?.toLowerCase().includes(searchLower) ||
                    cost.crane_maintenance?.notes?.toLowerCase().includes(searchLower);
                
                return matchesCost || matchesMaintenance;
            });
        }

        if (filters.category && filters.category !== 'all') {
            filtered = filtered.filter(cost => cost.category_id === filters.category);
        }

        if (filters.subcategory && filters.subcategory !== 'all') {
            filtered = filtered.filter(cost => cost.subcategory === filters.subcategory);
        }

        if (filters.dateFrom) {
            filtered = filtered.filter(cost => new Date(cost.date) >= filters.dateFrom!);
        }

        if (filters.dateTo) {
            filtered = filtered.filter(cost => new Date(cost.date) <= filters.dateTo!);
        }

        if (filters.operatorId && filters.operatorId !== 'all') {
            filtered = filtered.filter(cost => cost.operator_id === filters.operatorId);
        }

        if (filters.craneId && filters.craneId !== 'all') {
            filtered = filtered.filter(cost => cost.crane_id === filters.craneId);
        }

        if (filters.minAmount) {
            filtered = filtered.filter(cost => Number(cost.amount) >= Number(filters.minAmount));
        }

        if (filters.maxAmount) {
            filtered = filtered.filter(cost => Number(cost.amount) <= Number(filters.maxAmount));
        }

        return filtered;
    }, [filteredCostsByDate, searchTerm, filters]);

    const handleExportToExcel = useCallback(() => {
        if (finalFilteredCosts.length === 0) {
            alert('No hay datos para exportar');
            return;
        }

        const exportData = finalFilteredCosts.map(cost => ({
            Fecha: new Date(cost.date + 'T00:00:00').toLocaleDateString('es-ES'),
            Descripción: cost.description,
            Categoría: cost.cost_categories?.name || 'Sin categoría',
            Subcategoría: cost.subcategory || '',
            Monto: Number(cost.amount),
            'Asociado a': cost.cranes 
                ? `Grúa: ${cost.cranes.brand} ${cost.cranes.model} (${cost.cranes.license_plate})`
                : cost.operators 
                ? `Operador: ${cost.operators.name}`
                : cost.services 
                ? `Servicio: ${cost.services.folio}`
                : 'N/A',
            'Folio Servicio': cost.service_folio || '',
            Notas: cost.notes || ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Costos');
        
        const wscols = [
            { wch: 12 },
            { wch: 30 },
            { wch: 20 },
            { wch: 15 },
            { wch: 15 },
            { wch: 35 },
            { wch: 15 },
            { wch: 25 },
        ];
        ws['!cols'] = wscols;

        const fileName = `costos_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }, [finalFilteredCosts]);

    // Auto-force cards view on mobile
    useEffect(() => {
        if (isMobile && viewMode === 'table') {
            setViewMode('cards');
        }
    }, [isMobile]);

    const totalCosts = finalFilteredCosts.length;
    const totalAmount = finalFilteredCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);

    if (isLoading) {
        return (
            <div className="space-y-6 p-6">
                <Skeleton className="h-32 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-48 w-full" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${isMobile ? 'p-3' : 'p-6'}`}>
            {/* Header con botones de acción */}
            <div className={`flex ${isMobile ? 'flex-col gap-3' : 'flex-col sm:flex-row justify-between items-start sm:items-center gap-4'}`}>
                <div>
                    <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-foreground`}>
                        Gestión de Costos
                    </h1>
                    {!isMobile && (
                        <p className="text-muted-foreground mt-1">
                            Administra y registra todos los costos operativos
                        </p>
                    )}
                </div>
                
                <div className="flex gap-2 flex-wrap">
                    <Button 
                        onClick={() => setIsQuickFormOpen(true)}
                        className="bg-violet-600 hover:bg-violet-700 text-white"
                        size={isMobile ? 'sm' : 'default'}
                    >
                        <Zap className="w-4 h-4 mr-2" />
                        {isMobile ? 'Rápido' : 'Costo Rápido'}
                    </Button>
                    
                    <Button 
                        onClick={() => handleOpenForm(null)}
                        variant="outline"
                        size={isMobile ? 'sm' : 'default'}
                    >
                        <FileEdit className="w-4 h-4 mr-2" />
                        {isMobile ? 'Completo' : 'Costo Completo'}
                    </Button>
                    
                    <Button 
                        onClick={handleOpenXMLUpload}
                        variant="outline"
                        size={isMobile ? 'sm' : 'default'}
                        className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                    >
                        {isMobile ? 'XML' : 'Cargar XML'}
                    </Button>
                    
                    <Button 
                        onClick={() => setIsCSVUploadOpen(true)}
                        variant="outline"
                        size={isMobile ? 'sm' : 'default'}
                        className="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                    >
                        <FileSpreadsheet className="w-4 h-4 mr-1" />
                        {isMobile ? 'Excel' : 'Cargar Excel'}
                    </Button>
                </div>
            </div>

            {/* Dashboard de métricas */}
            {showDashboard && (
                <CostsDashboard
                    costs={finalFilteredCosts}
                    dateFilter={dateFilter}
                    allCosts={costs}
                />
            )}

            {/* Filtros unificados */}
            <UnifiedCostFilters
                filters={filters}
                onFiltersChange={setFilters}
                onClearFilters={handleClearFilters}
                dateFilter={dateFilter}
                onDateFilterChange={setDateFilter}
                totalResults={totalCosts}
                totalCosts={costs.length}
                todayCount={dateMetrics.today.count}
            />

            {/* Barra de búsqueda */}
            <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center gap-3'}`}>
                <div className="flex-1 relative">
                    <input
                        type="text"
                        placeholder="Buscar por descripción, categoría, folio..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 pl-10 rounded-lg border bg-background text-foreground focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                
                <div className="flex items-center gap-2">
                    {!isMobile && (
                        <div className="flex items-center gap-2 border rounded-lg p-1">
                            <Button
                                variant={viewMode === 'table' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('table')}
                                className={viewMode === 'table' ? 'bg-violet-600 hover:bg-violet-700' : ''}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </Button>
                            <Button
                                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('cards')}
                                className={viewMode === 'cards' ? 'bg-violet-600 hover:bg-violet-700' : ''}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                            </Button>
                        </div>
                    )}

                    <Button variant="outline" onClick={handleExportToExcel} size={isMobile ? 'sm' : 'default'}>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="hidden sm:inline">Exportar</span>
                    </Button>
                </div>
            </div>
            
            {viewMode === 'table' ? (
                <EnhancedCostsTable
                    costs={finalFilteredCosts}
                    onEdit={handleOpenForm}
                    onDelete={handleDeleteCost}
                    onViewDetails={handleViewDetails}
                    onDuplicate={handleDuplicateCost}
                    loading={isLoading}
                    highlightedCostId={highlightedCostId}
                    selectedCosts={selectedCostIds}
                    onSelectionChange={setSelectedCostIds}
                    onBatchUpdate={() => setIsBatchUpdateOpen(true)}
                    onBatchMarkPaid={() => setIsBatchMarkPaidOpen(true)}
                />
            ) : (
                <CostList 
                    costs={finalFilteredCosts}
                    onEdit={handleOpenForm}
                    onDelete={handleDeleteCost}
                    onViewDetails={handleViewDetails}
                    onDuplicate={handleDuplicateCost}
                    loading={isLoading}
                    highlightedCostId={highlightedCostId}
                />
            )}
            
            {/* Modal de costo rápido */}
            <QuickCostForm
                isOpen={isQuickFormOpen}
                onClose={() => setIsQuickFormOpen(false)}
                onSuccess={() => {
                    invalidateAll();
                }}
            />

            {/* Modal de costo completo */}
            <CostForm
                isOpen={isFormOpen}
                onClose={handleCloseForm}
                cost={selectedCostForEdit}
                prefilledData={prefilledDataForDuplication}
                onInventoryCostCreated={handleInventoryCostCreated}
            />
            
            {/* Modal de detalles consolidado */}
            {selectedCostForDetails && (
                <ConsolidatedCostDetails
                    cost={selectedCostForDetails}
                    isOpen={isDetailsOpen}
                    onClose={handleCloseDetails}
                    onEdit={handleOpenForm}
                    onDuplicate={handleDuplicateCost}
                />
            )}
            
            <XMLCostUpload
                isOpen={isXMLUploadOpen}
                onClose={handleCloseXMLUpload}
                onSuccess={handleXMLUploadSuccess}
            />

            <CSVCostUpload
                isOpen={isCSVUploadOpen}
                onClose={() => setIsCSVUploadOpen(false)}
                onSuccess={(count) => setIsCSVUploadOpen(false)}
            />

            <CostBatchUpdateModal
                open={isBatchUpdateOpen}
                onOpenChange={(open) => {
                    setIsBatchUpdateOpen(open);
                    if (!open) setSelectedCostIds(new Set());
                }}
                selectedCosts={finalFilteredCosts.filter(c => selectedCostIds.has(c.id))}
            />

            <CostBatchUpdateModal
                open={isBatchMarkPaidOpen}
                mode="markPaid"
                onOpenChange={(open) => {
                    setIsBatchMarkPaidOpen(open);
                    if (!open) setSelectedCostIds(new Set());
                }}
                selectedCosts={finalFilteredCosts.filter(c => selectedCostIds.has(c.id))}
            />

            <DistributionAssistantDialog
                open={isDistributionOpen}
                onOpenChange={setIsDistributionOpen}
                inventoryData={distributionData}
            />

            <CostDeleteConfirmDialog
                cost={costToDelete}
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                onConfirmDelete={handleConfirmDelete}
            />
        </div>
    );
};

export default CostsPage;
