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
import { usePagedCosts, useDeleteCost } from '@/hooks/useCosts';
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
import { getTodayLocal, safeParseDateOnly, getPeriodRange, CostPeriod } from '@/utils/timezoneUtils';

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
    const [dateFilter, setDateFilter] = useState<CostPeriod>('all');
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
        dateFrom: '',
        dateTo: '',
        operatorId: 'all',
        craneId: 'all',
        serviceId: '',
        minAmount: '',
        maxAmount: '',
        costCenterId: 'all',
    });

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // Rango inválido (desde > hasta): no enviar la query, solo marcar visualmente
    const isDateRangeInvalid = Boolean(
        filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo
    );

    // Filtro de fechas server-side: período rápido (Hoy/Semana/Mes) y rango
    // avanzado se intersectan en un solo rango que viaja al hook y a la queryKey
    const periodRange = getPeriodRange(dateFilter);
    const advancedFrom = isDateRangeInvalid ? '' : filters.dateFrom;
    const advancedTo = isDateRangeInvalid ? '' : filters.dateTo;
    const fromCandidates = [periodRange?.from, advancedFrom].filter(Boolean) as string[];
    const toCandidates = [periodRange?.to, advancedTo].filter(Boolean) as string[];
    const dateFrom = fromCandidates.length ? fromCandidates.reduce((a, b) => (a > b ? a : b)) : '';
    const dateTo = toCandidates.length ? toCandidates.reduce((a, b) => (a < b ? a : b)) : '';

    const serverSearchTerm = searchTerm && !searchTerm.startsWith('id:') ? searchTerm : undefined;
    const { data: pagedResult, isLoading } = usePagedCosts(page, pageSize, {
        dateFrom,
        dateTo,
        searchTerm: serverSearchTerm,
        entity: 'gruas_5_norte',
    });
    const costs: Cost[] = pagedResult?.costs ?? [];
    const totalCostCount = pagedResult?.total ?? 0;

    // Reiniciar página cuando cambian los filtros de fecha o búsqueda
    useEffect(() => {
        setPage(1);
    }, [dateFrom, dateTo, pageSize, searchTerm]);
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
            dateFrom: '',
            dateTo: '',
            operatorId: 'all',
            craneId: 'all',
            serviceId: '',
            minAmount: '',
            maxAmount: '',
            costCenterId: 'all',
        });
        setPage(1);
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

    // El período (Hoy/Semana/Mes) y el rango avanzado ya vienen filtrados
    // server-side desde useCosts — aquí solo filtros de texto y atributos
    const finalFilteredCosts = useMemo(() => {
        let filtered = baseCosts;

        if (searchTerm.startsWith('id:')) {
            const costId = searchTerm.substring(3);
            filtered = filtered.filter(cost => matchesCostIdentifier(cost.id, costId));
        }
        // Los demás términos de búsqueda se filtran server-side en usePagedCosts

        if (filters.category && filters.category !== 'all') {
            filtered = filtered.filter(cost => cost.category_id === filters.category);
        }

        if (filters.subcategory && filters.subcategory !== 'all') {
            filtered = filtered.filter(cost => cost.subcategory === filters.subcategory);
        }

        // dateFrom/dateTo se filtran server-side en useCosts — no duplicar aquí

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
    }, [baseCosts, searchTerm, filters]);

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
                    serverPage={page}
                    serverPageSize={pageSize}
                    serverTotal={totalCostCount}
                    onServerPageChange={setPage}
                    onServerPageSizeChange={setPageSize}
                    disableServerPagination={!!serverSearchTerm}
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
