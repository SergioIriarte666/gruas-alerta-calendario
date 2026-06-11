import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { CostList } from '@/components/costs/CostList';
import { EnhancedCostsTable } from '@/components/costs/EnhancedCostsTable';
import { CostForm } from '@/components/costs/CostForm';
import { QuickCostForm } from '@/components/costs/QuickCostForm';
import { ConsolidatedCostDetails } from '@/components/costs/ConsolidatedCostDetails';
import { XMLCostUpload } from '@/components/costs/XMLCostUpload';
import { CSVCostUpload } from '@/components/costs/CSVCostUpload';
import { ManualCostXmlImportDialog } from '@/components/costs/ManualCostXmlImportDialog';

import { CostFilters } from '@/components/costs/CostFilters';
import { UnifiedCostFilters } from '@/components/costs/UnifiedCostFilters';
import { CostsDashboard } from '@/components/costs/CostsDashboard';
import { CostBatchUpdateModal } from '@/components/costs/CostBatchUpdateModal';
import { DistributionAssistantDialog } from '@/components/costs/dialogs/DistributionAssistantDialog';
import { CostDeleteConfirmDialog } from '@/components/costs/CostDeleteConfirmDialog';
import { useCosts, useDeleteCost } from '@/hooks/useCosts';
import { useUniversalSync } from '@/hooks/useUniversalSync';
import { useInventorySyncWatcher } from '@/hooks/useInventorySyncWatcher';
import { useDateFilters } from '@/hooks/useDateFilters';
import { Cost } from '@/types/costs';
import { matchesCostIdentifier, prepareCostForDuplication } from '@/utils/costHelpers';
import { Skeleton } from '@/components/ui/skeleton';
import { Zap, FileEdit, FileSpreadsheet } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import * as XLSX from 'xlsx';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import { getCurrentWeekRange, getTodayLocal, safeParseDateOnly, getBusinessToday } from '@/utils/timezoneUtils';

const CostsPage = () => {
    useInventorySyncWatcher();
    const isMobile = useIsMobile();
    const [searchParams] = useSearchParams();
    const location = useLocation() as { state?: { prefilledData?: any } } | any;
    const navigate = useNavigate();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isQuickFormOpen, setIsQuickFormOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isXMLUploadOpen, setIsXMLUploadOpen] = useState(false);
    const [isCSVUploadOpen, setIsCSVUploadOpen] = useState(false);
    const [isManualXmlImportOpen, setIsManualXmlImportOpen] = useState(false);
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
        maxAmount: '',
        costCenterId: 'all',
    });
    
    const { data: costs = [], isLoading } = useCosts();
    const { mutate: deleteCost } = useDeleteCost();
    const { invalidateAll } = useUniversalSync();
    const dateMetrics = useDateFilters(costs);
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

    // Efecto para manejar parámetros de URL
    useEffect(() => {
        const costId = searchParams.get('costId');
        const costCenter = searchParams.get('costCenter');

        if (costId) {
            setHighlightedCostId(costId);
            setSearchTerm(`id:${costId}`);
        }

        if (costCenter) {
            setFilters(prev => ({ ...prev, costCenterId: costCenter }));
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

    const handleOpenManualXmlImport = useCallback((cost: Cost) => {
        if (cost.payment_date && user?.role !== 'admin') {
            toast.error('Este costo está marcado como pagado y no puede ser modificado sin autorización especial');
            return;
        }

        setSelectedCostForDetails(cost);
        setIsDetailsOpen(false);
        setIsManualXmlImportOpen(true);
    }, [user]);

    const handleManualXmlImportOpenChange = useCallback((open: boolean) => {
        setIsManualXmlImportOpen(open);
        if (!open && selectedCostForDetails) {
            setIsDetailsOpen(true);
        }
    }, [selectedCostForDetails]);

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
            maxAmount: '',
            costCenterId: 'all',
        });
    }, []);

    const handleOpenXMLUpload = useCallback(() => {
        setIsXMLUploadOpen(true);
    }, []);

    const handleCloseXMLUpload = useCallback(() => {
        setIsXMLUploadOpen(false);
    }, []);

    const handleXMLUploadSuccess = useCallback(() => {
        setHighlightedCostId('');
    }, []);

    const isCommission = (cost: Cost) =>
        cost.cost_categories?.name?.toLowerCase().includes('comisi') ||
        cost.subcategory?.toLowerCase().includes('comisi');

    // Filtrar costos por fecha y término de búsqueda
    // Las comisiones siempre pasan el filtro de fecha (su fecha es la del servicio, no la de creación)
    const filteredCostsByDate = useMemo(() => {
        let filtered = baseCosts;
        const todayStr = getBusinessToday(); // YYYY-MM-DD en TZ negocio
        switch (dateFilter) {
            case 'today':
                filtered = baseCosts.filter(cost => {
                    return isCommission(cost) || (cost.date || '').slice(0, 10) === todayStr;
                });
                break;
            case 'week': {
                const { start: weekStart, end: weekEnd } = getCurrentWeekRange();
                filtered = baseCosts.filter(cost => {
                    const costDate = safeParseDateOnly(cost.date);
                    return isCommission(cost) || (costDate >= weekStart && costDate <= weekEnd);
                });
                break;
            }
            case 'month':
                filtered = baseCosts.filter(cost => {
                    return isCommission(cost) || (cost.date || '').slice(0, 7) === todayStr.slice(0, 7);
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
            filtered = filtered.filter(cost => matchesCostIdentifier(cost.id, costId));
        } else if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(cost => {
                const matchesCost = matchesCostIdentifier(cost.id, searchLower) ||
                    cost.description.toLowerCase().includes(searchLower) ||
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
            filtered = filtered.filter(cost => safeParseDateOnly(cost.date) >= filters.dateFrom!);
        }

        if (filters.dateTo) {
            filtered = filtered.filter(cost => safeParseDateOnly(cost.date) <= filters.dateTo!);
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

        if (filters.costCenterId && filters.costCenterId !== 'all') {
            filtered = filtered.filter(cost => cost.cost_center_id === filters.costCenterId);
        }

        return filtered;
    }, [filteredCostsByDate, searchTerm, filters]);

    const handleExportToExcel = useCallback(() => {
        if (finalFilteredCosts.length === 0) {
            toast.error('No hay datos para exportar');
            return;
        }

        const exportData = finalFilteredCosts.map(cost => ({
            Fecha: cost.date ? safeParseDateOnly(cost.date).toLocaleDateString('es-CL') : '',
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

        const fileName = `costos_${getTodayLocal()}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }, [finalFilteredCosts]);

    // Auto-force cards view on mobile
    useEffect(() => {
        if (isMobile && viewMode === 'table') {
            setViewMode('cards');
        }
    }, [isMobile]);

    const totalCosts = finalFilteredCosts.length;
    if (isLoading) {
        return (
            <div className="space-y-6">
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
        <div className="space-y-6">
            <PageHeader
                title="Gestión de Costos"
                description="Administra costos operativos, filtros analíticos y acciones masivas desde una misma superficie."
                actions={
                    <div className={`flex ${isMobile ? 'w-full flex-col gap-2' : 'flex-wrap items-center gap-2'}`}>
                        <Button
                            onClick={() => setIsQuickFormOpen(true)}
                            size={isMobile ? 'default' : 'sm'}
                            className={isMobile ? 'w-full' : ''}
                        >
                            <Zap className="mr-2 size-4" />
                            {isMobile ? 'Costo Rápido' : 'Nuevo Costo Rápido'}
                        </Button>

                        <Button
                            onClick={() => handleOpenForm(null)}
                            variant="outline"
                            size={isMobile ? 'default' : 'sm'}
                            className={isMobile ? 'w-full border-border/70 bg-card/70' : 'border-border/70 bg-card/70'}
                        >
                            <FileEdit className="mr-2 size-4" />
                            Costo Completo
                        </Button>

                        <Button
                            onClick={handleOpenXMLUpload}
                            variant="outline"
                            size={isMobile ? 'default' : 'sm'}
                            className={isMobile ? 'w-full border-info/20 bg-info/10 text-info hover:bg-info/15' : 'border-info/20 bg-info/10 text-info hover:bg-info/15'}
                        >
                            XML
                        </Button>

                        <Button
                            onClick={() => setIsCSVUploadOpen(true)}
                            variant="outline"
                            size={isMobile ? 'default' : 'sm'}
                            className={isMobile ? 'w-full border-success/20 bg-success/10 text-success hover:bg-success/15' : 'border-success/20 bg-success/10 text-success hover:bg-success/15'}
                        >
                            <FileSpreadsheet className="mr-2 size-4" />
                            Carga Excel
                        </Button>
                    </div>
                }
            />

            <CostsDashboard
                costs={finalFilteredCosts}
                dateFilter={dateFilter}
                allCosts={costs}
            />

            <UnifiedCostFilters
                filters={filters}
                onFiltersChange={setFilters}
                onClearFilters={handleClearFilters}
                dateFilter={dateFilter}
                onDateFilterChange={setDateFilter}
                totalResults={totalCosts}
                totalCosts={costs.length}
                todayCount={dateMetrics.today.count}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onExport={handleExportToExcel}
                isMobile={isMobile}
            />
            
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
                    onImportXml={handleOpenManualXmlImport}
                />
            )}

            {selectedCostForDetails && (
                <ManualCostXmlImportDialog
                    open={isManualXmlImportOpen}
                    onOpenChange={handleManualXmlImportOpenChange}
                    cost={selectedCostForDetails}
                    onImported={(updatedCost) => {
                        setSelectedCostForDetails(updatedCost);
                        handleManualXmlImportOpenChange(false);
                    }}
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
                onSuccess={() => setIsCSVUploadOpen(false)}
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
