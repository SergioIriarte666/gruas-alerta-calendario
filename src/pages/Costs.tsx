import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CostsHeader } from '@/components/costs/CostsHeader';
import { CostList } from '@/components/costs/CostList';
import { CostsTableView } from '@/components/costs/CostsTableView';
import { CostForm } from '@/components/costs/CostForm';
import { CostDetailsModal } from '@/components/costs/CostDetailsModal';
import { XMLCostUpload } from '@/components/costs/XMLCostUpload';
import { CostFilters } from '@/components/costs/CostFilters';
import { CostBatchUpdateModal } from '@/components/costs/CostBatchUpdateModal';
import { useCosts, useDeleteCost } from '@/hooks/useCosts';
import { useCostInvalidation } from '@/hooks/useCostInvalidation';
import { useQueryClient } from '@tanstack/react-query';
import { useDateFilters } from '@/hooks/useDateFilters';
import { Cost } from '@/types/costs';
import { Skeleton } from '@/components/ui/skeleton';
import * as XLSX from 'xlsx';
import { 
  getCurrentChileDate, 
  formatForDisplay,
  formatForDatabase,
  getCurrentWeekRange 
} from '@/utils/timezoneUtils';

const CostsPage = () => {
    const [searchParams] = useSearchParams();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isXMLUploadOpen, setIsXMLUploadOpen] = useState(false);
    const [isBatchUpdateOpen, setIsBatchUpdateOpen] = useState(false);
    const [selectedCostForEdit, setSelectedCostForEdit] = useState<Cost | null>(null);
    const [selectedCostForDetails, setSelectedCostForDetails] = useState<Cost | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
    const [highlightedCostId, setHighlightedCostId] = useState<string>('');
    const [dateFilter, setDateFilter] = useState<string>('all');
    const [selectedCostIds, setSelectedCostIds] = useState<Set<string>>(new Set());
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
    const { invalidateAllCostQueries } = useCostInvalidation();
    const dateMetrics = useDateFilters(costs);
    const queryClient = useQueryClient();

    // Debug function to manually refresh costs using the same invalidation logic
    const handleManualRefresh = useCallback(() => {
        console.log('🔄 Manual refresh triggered');
        invalidateAllCostQueries();
    }, [invalidateAllCostQueries]);

    // Forzar invalidación automática al cargar la página
    useEffect(() => {
        const forceRefresh = async () => {
            queryClient.invalidateQueries({ queryKey: ['commissions'] });
            queryClient.invalidateQueries({ queryKey: ['costs'] });
            queryClient.invalidateQueries({ queryKey: ['services'] });
        };
        
        forceRefresh();
    }, []); // Solo se ejecuta al montar el componente

    // Efecto para manejar el parámetro costId de la URL
    useEffect(() => {
        const costId = searchParams.get('costId');
        if (costId) {
            setHighlightedCostId(costId);
            setSearchTerm(`id:${costId}`);
        }
    }, [searchParams]);

    const handleOpenForm = useCallback((cost: Cost | null = null) => {
        setSelectedCostForEdit(cost);
        setIsFormOpen(true);
    }, []);

    const handleCloseForm = useCallback(() => {
        setIsFormOpen(false);
        setSelectedCostForEdit(null);
    }, []);

    const handleViewDetails = useCallback((cost: Cost) => {
        setSelectedCostForDetails(cost);
        setIsDetailsOpen(true);
    }, []);

    const handleCloseDetails = useCallback(() => {
        setSelectedCostForDetails(null);
        setIsDetailsOpen(false);
    }, []);

    const handleDeleteCost = useCallback((cost: Cost) => {
        deleteCost(cost.id);
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
        // Los datos se actualizarán automáticamente por React Query
        setHighlightedCostId(''); // Reset highlight
    }, []);

    // Filtrar costos por fecha y término de búsqueda
    const filteredCostsByDate = useMemo(() => {
        let filtered = costs;
        const today = new Date();

        // Aplicar filtro de fecha primero
        switch (dateFilter) {
            case 'today':
                filtered = costs.filter(cost => {
                    const costDate = new Date(cost.date + 'T00:00:00');
                    return costDate.toDateString() === today.toDateString();
                });
                break;
            case 'week':
                const { start: weekStart, end: weekEnd } = getCurrentWeekRange();
                
                filtered = costs.filter(cost => {
                    const costDate = new Date(cost.date + 'T00:00:00');
                    return costDate >= weekStart && costDate <= weekEnd;
                });
                break;
            case 'month':
                filtered = costs.filter(cost => {
                    const costDate = new Date(cost.date + 'T00:00:00');
                    return costDate.getMonth() === today.getMonth() && 
                           costDate.getFullYear() === today.getFullYear();
                });
                break;
            case 'all':
            default:
                filtered = costs;
                break;
        }

        return filtered;
    }, [costs, dateFilter]);

    // Aplicar filtros adicionales (búsqueda y filtros avanzados)
    const finalFilteredCosts = useMemo(() => {
        let filtered = filteredCostsByDate;

        // Filtro especial para ID específico
        if (searchTerm.startsWith('id:')) {
            const costId = searchTerm.substring(3);
            filtered = filtered.filter(cost => cost.id === costId);
        } else if (searchTerm) {
            // Enhanced search filter (includes maintenance descriptions)
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(cost => {
                // Search in cost fields
                const matchesCost = cost.description.toLowerCase().includes(searchLower) ||
                    cost.notes?.toLowerCase().includes(searchLower) ||
                    cost.cost_categories?.name.toLowerCase().includes(searchLower) ||
                    cost.subcategory?.toLowerCase().includes(searchLower) ||
                    (cost.service_folio && cost.service_folio.toLowerCase().includes(searchLower)) ||
                    (cost.services?.folio && cost.services.folio.toLowerCase().includes(searchLower));
                
                // Search in linked maintenance description if exists
                const matchesMaintenance = cost.crane_maintenance?.description?.toLowerCase().includes(searchLower) ||
                    cost.crane_maintenance?.provider?.toLowerCase().includes(searchLower) ||
                    cost.crane_maintenance?.maintenance_type?.toLowerCase().includes(searchLower) ||
                    cost.crane_maintenance?.notes?.toLowerCase().includes(searchLower);
                
                return matchesCost || matchesMaintenance;
            });
        }

        // Filtros avanzados
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
        
        // Ajustar ancho de columnas
        const wscols = [
            { wch: 12 }, // Fecha
            { wch: 30 }, // Descripción
            { wch: 20 }, // Categoría
            { wch: 15 }, // Subcategoría
            { wch: 15 }, // Monto
            { wch: 35 }, // Asociado a
            { wch: 15 }, // Folio Servicio
            { wch: 25 }, // Notas
        ];
        ws['!cols'] = wscols;

        const fileName = `costos_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }, [finalFilteredCosts]);

    // Calcular métricas finales
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
        <div className="space-y-6 p-6">
            <CostsHeader 
                onAddCost={() => handleOpenForm(null)}
                onXMLUpload={handleOpenXMLUpload}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onExport={handleExportToExcel}
                totalCosts={totalCosts}
                totalAmount={totalAmount}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                filters={filters}
                onFiltersChange={setFilters}
                onClearFilters={handleClearFilters}
                dateFilter={dateFilter}
                onDateFilterChange={setDateFilter}
                todayCount={dateMetrics.today.count}
                currentMonthTotal={dateMetrics.currentMonth.total}
                monthVariation={dateMetrics.currentMonth.variation}
            />
            
            {viewMode === 'table' ? (
                <CostsTableView
                    costs={finalFilteredCosts}
                    onEdit={handleOpenForm}
                    onDelete={handleDeleteCost}
                    onViewDetails={handleViewDetails}
                    loading={isLoading}
                    highlightedCostId={highlightedCostId}
                    selectedCosts={selectedCostIds}
                    onSelectionChange={setSelectedCostIds}
                    onBatchUpdate={() => setIsBatchUpdateOpen(true)}
                />
            ) : (
                <CostList 
                    costs={finalFilteredCosts}
                    onEdit={handleOpenForm}
                    onDelete={handleDeleteCost}
                    onViewDetails={handleViewDetails}
                    loading={isLoading}
                    highlightedCostId={highlightedCostId}
                />
            )}
            
            <CostForm
                isOpen={isFormOpen}
                onClose={handleCloseForm}
                cost={selectedCostForEdit}
            />
            
            {selectedCostForDetails && (
                <CostDetailsModal
                    cost={selectedCostForDetails}
                    isOpen={isDetailsOpen}
                    onClose={handleCloseDetails}
                />
            )}
            
            <XMLCostUpload
                isOpen={isXMLUploadOpen}
                onClose={handleCloseXMLUpload}
                onSuccess={handleXMLUploadSuccess}
            />

            <CostBatchUpdateModal
                open={isBatchUpdateOpen}
                onOpenChange={(open) => {
                    setIsBatchUpdateOpen(open);
                    if (!open) setSelectedCostIds(new Set());
                }}
                selectedCosts={finalFilteredCosts.filter(c => selectedCostIds.has(c.id))}
            />
        </div>
    );
};

export default CostsPage;
