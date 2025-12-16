
import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useServices } from '@/hooks/useServices';
import { useServiceManager } from './useServiceManager';
import { useUser } from '@/contexts/UserContext';
import { Service, ServiceStatus } from '@/types';
import { toast } from 'sonner';
import { isFutureDate, parseFromDatabase } from '@/utils/timezoneUtils';
import { supabase } from '@/integrations/supabase/client';
import { prepareServiceForDuplication } from '@/utils/serviceHelpers';
import { AdvancedFilters } from '@/hooks/useAdvancedFilters';

export const useServicesPage = () => {
  const { services, loading, deleteService: legacyDeleteService, refetch } = useServices();
  const { createService, updateService, deleteService } = useServiceManager();
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const statusParam = params.get('status');
  const futureParam = params.get('future');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCSVUploadOpen, setIsCSVUploadOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(statusParam || 'all');
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters | null>(null);
  const [prefilledData, setPrefilledData] = useState<any>(null);
  const [fromCalendarEvent, setFromCalendarEvent] = useState(false);
  const [sortField, setSortField] = useState<'folio' | 'date' | 'client' | 'vehicle' | 'crane' | 'operator' | 'value' | 'status' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Batch selection state
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [isBatchClosing, setIsBatchClosing] = useState(false);

  const newSaleHandledRef = useRef(false);

  const isAdmin = user?.role === 'admin';
  const ITEMS_PER_PAGE = 10;

  // Handle pre-filled data from calendar events
  useEffect(() => {
    if (location.state?.prefilledData && location.state?.openForm) {
      console.log('🎯 Detected calendar event conversion, setting up form');
      setPrefilledData(location.state.prefilledData);
      setFromCalendarEvent(true);
      setIsFormOpen(true);
      // Clear the location state to prevent reloading on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Handle newSale parameter from inventory module
  useEffect(() => {
    const search = new URLSearchParams(location.search);
    if (search.get('newSale') === 'true' && !newSaleHandledRef.current) {
      newSaleHandledRef.current = true;
      console.log('🛒 Detected newSale parameter, opening form for sale');
      setIsFormOpen(true);
      // Clear the newSale parameter from URL to prevent re-opening on refresh
      const newSearch = new URLSearchParams(location.search);
      newSearch.delete('newSale');
      navigate({ pathname: location.pathname, search: newSearch.toString() ? `?${newSearch.toString()}` : '' }, { replace: true });
    }
  }, [location.search, navigate]);

  const handleAdvancedFiltersChange = (filters: AdvancedFilters | null) => {
    setAdvancedFilters(filters);
    setCurrentPage(1);
  };

  const hasAdvancedFilters = advancedFilters !== null;

  const filteredAndSortedServices = (() => {
    // Función de normalización para búsqueda flexible
    const normalizeSearchTerm = (text: string): string => {
      return text.toLowerCase().replace(/[-\s_]/g, '').trim();
    };

    const normalizedSearchTerm = normalizeSearchTerm(searchTerm);
    
    const filtered = services.filter(service => {
      // 1. Basic search filter
      const matchesSearch = normalizedSearchTerm === '' || (
        normalizeSearchTerm(service.folio || '').includes(normalizedSearchTerm) ||
        normalizeSearchTerm(service.client?.name || '').includes(normalizedSearchTerm) ||
        normalizeSearchTerm(service.licensePlate || '').includes(normalizedSearchTerm) ||
        normalizeSearchTerm(service.vehicleBrand || '').includes(normalizedSearchTerm) ||
        normalizeSearchTerm(service.quoteNumber || '').includes(normalizedSearchTerm) ||
        normalizeSearchTerm(service.purchaseOrder || '').includes(normalizedSearchTerm) ||
        normalizeSearchTerm(service.purchaseOrderNumber || '').includes(normalizedSearchTerm) ||
        normalizeSearchTerm(service.invoiceNumeroFiscal || '').includes(normalizedSearchTerm)
      );
      
      if (!matchesSearch) return false;

      // 2. Status filter
      let matchesStatus = false;
      if (statusFilter === 'all') {
        matchesStatus = true;
      } else if (statusFilter === 'with_purchase_order') {
        matchesStatus = !!(
          (service.purchaseOrderNumber && service.purchaseOrderNumber.trim() !== '') ||
          (service.purchaseOrder && service.purchaseOrder.trim() !== '')
        );
      } else {
        const statusesToFilter = statusFilter.split(',');
        matchesStatus = statusesToFilter.includes(service.status);
      }
      
      if (!matchesStatus) return false;
      
      // 3. Future filter from URL param
      const matchesFuture = futureParam !== 'true' || isFutureDate(service.serviceDate);
      if (!matchesFuture) return false;

      // 4. Advanced filters (only if active)
      if (advancedFilters) {
        // Service type filter
        if (advancedFilters.serviceTypeId && service.serviceType?.id !== advancedFilters.serviceTypeId) {
          return false;
        }
        
        // License plate filter
        if (advancedFilters.licensePlate && !normalizeSearchTerm(service.licensePlate || '').includes(normalizeSearchTerm(advancedFilters.licensePlate))) {
          return false;
        }
        
        // Quote number filter
        if (advancedFilters.quoteNumber && !normalizeSearchTerm(service.quoteNumber || '').includes(normalizeSearchTerm(advancedFilters.quoteNumber))) {
          return false;
        }
        
        // Purchase order filter
        if (advancedFilters.purchaseOrderNumber && !normalizeSearchTerm(service.purchaseOrderNumber || service.purchaseOrder || '').includes(normalizeSearchTerm(advancedFilters.purchaseOrderNumber))) {
          return false;
        }
        
        // Numero fiscal filter
        if (advancedFilters.numeroFiscal && !normalizeSearchTerm(service.invoiceNumeroFiscal || '').includes(normalizeSearchTerm(advancedFilters.numeroFiscal))) {
          return false;
        }
        
        // Date range filters
        if (advancedFilters.dateFrom || advancedFilters.dateTo) {
          const serviceDate = service.serviceDate ? parseFromDatabase(service.serviceDate) : null;
          if (!serviceDate) return false;
          
          if (advancedFilters.dateFrom) {
            const fromDate = new Date(advancedFilters.dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            if (serviceDate < fromDate) return false;
          }
          
          if (advancedFilters.dateTo) {
            const toDate = new Date(advancedFilters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            if (serviceDate > toDate) return false;
          }
        }
      }
      
      return true;
    });

    // Apply sorting if active
    if (sortField) {
      filtered.sort((a, b) => {
        let valueA: any, valueB: any;
        
        switch (sortField) {
          case 'folio':
            valueA = a.folio;
            valueB = b.folio;
            break;
          case 'date':
            valueA = new Date(a.serviceDate);
            valueB = new Date(b.serviceDate);
            break;
          case 'client':
            valueA = a.client?.name || '';
            valueB = b.client?.name || '';
            break;
          case 'vehicle':
            valueA = `${a.vehicleBrand} ${a.vehicleModel} ${a.licensePlate}`.trim();
            valueB = `${b.vehicleBrand} ${b.vehicleModel} ${b.licensePlate}`.trim();
            break;
          case 'crane':
            valueA = a.crane?.licensePlate || '';
            valueB = b.crane?.licensePlate || '';
            break;
          case 'operator':
            valueA = a.operator?.name || '';
            valueB = b.operator?.name || '';
            break;
          case 'value':
            valueA = a.value || 0;
            valueB = b.value || 0;
            break;
          case 'status':
            valueA = a.status;
            valueB = b.status;
            break;
          default:
            return 0;
        }
        
        // Handle different data types
        if (valueA instanceof Date && valueB instanceof Date) {
          return sortDirection === 'asc' 
            ? valueA.getTime() - valueB.getTime()
            : valueB.getTime() - valueA.getTime();
        }
        
        if (typeof valueA === 'number' && typeof valueB === 'number') {
          return sortDirection === 'asc' 
            ? valueA - valueB 
            : valueB - valueA;
        }
        
        // String comparison
        const stringA = String(valueA).toLowerCase();
        const stringB = String(valueB).toLowerCase();
        
        if (sortDirection === 'asc') {
          return stringA.localeCompare(stringB);
        } else {
          return stringB.localeCompare(stringA);
        }
      });
    }

    return filtered;
  })();

  const totalPages = Math.ceil(filteredAndSortedServices.length / ITEMS_PER_PAGE);
  const paginatedServices = filteredAndSortedServices.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Calculate selected services data for batch action bar
  const selectedServicesData = services.filter(s => selectedServiceIds.has(s.id));
  const selectedServicesTotal = selectedServicesData.reduce((sum, s) => sum + (s.value || 0), 0);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      toast.success('Datos actualizados correctamente');
    } catch (error) {
      console.error('Error refreshing services:', error);
      toast.error('No se pudieron actualizar los datos');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateService = async (createdService: Service) => {
    try {
      console.log('📝 [UNIFIED_PAGE] Post-processing created service:', createdService.folio);
      // El servicio ya fue creado exitosamente en EnhancedServiceForm
      // Solo cerramos modal y refrescamos lista
      setIsFormOpen(false);
      setEditingService(null);
      setPrefilledData(null);
      setFromCalendarEvent(false);
      await refetch();
      console.log('✅ [UNIFIED_PAGE] Service creation post-processing completed');
    } catch (error) {
      console.error('Error in post-creation processing:', error);
      toast.error('Servicio creado pero error al actualizar la lista');
    }
  };

  const handleUpdateService = async (updatedService: Service) => {
    try {
      console.log('📝 [UNIFIED_PAGE] Post-processing updated service:', updatedService.folio);
      // El servicio ya fue actualizado exitosamente en EnhancedServiceForm
      // Solo cerramos modal y refrescamos lista
      setEditingService(null);
      setIsFormOpen(false);
      setPrefilledData(null);
      setFromCalendarEvent(false);
      await refetch();
      console.log('✅ [UNIFIED_PAGE] Service update post-processing completed');
    } catch (error) {
      console.error('Error in post-update processing:', error);
      toast.error('Servicio actualizado pero error al actualizar la lista');
    }
  };

  const handleFormOpenChange = (open: boolean) => {
    if (!open) {
      setEditingService(null);
      setPrefilledData(null);
      setFromCalendarEvent(false);
    }
    setIsFormOpen(open);
  };

  const handleCloseService = async (service: Service) => {
    if (service.status === 'invoiced') {
      toast.error('No se puede cerrar un servicio que ya está facturado');
      return;
    }

    if (window.confirm(`¿Estás seguro de que deseas cerrar el servicio ${service.folio}? El estado cambiará a "Completado".`)) {
      try {
        console.log('🔄 [CLOSE_SERVICE] Attempting to close service:', service.folio, service.id);
        
        // SOLUCIÓN DEFINITIVA: Función de emergencia que bypassa todos los triggers
        const { data, error: updateError } = await supabase.rpc('emergency_close_service', {
          p_service_id: service.id
        });

        console.log('🔄 [CLOSE_SERVICE] Database function result:', { data, updateError });

        if (updateError) {
          console.error('🚨 [CLOSE_SERVICE] RPC error:', updateError);
          throw new Error(`Error al cerrar servicio: ${updateError.message}`);
        }

        if (!(data as any)?.success) {
          console.error('🚨 [CLOSE_SERVICE] Function returned error:', (data as any)?.error);
          throw new Error(`Error al cerrar servicio: ${(data as any)?.error || 'Error desconocido'}`);
        }
        
        console.log('✅ [CLOSE_SERVICE] Service closed successfully:', service.folio);
        await refetch();
        toast.success('El servicio se ha cerrado exitosamente');
      } catch (error) {
        console.error('Error closing service:', error);
        toast.error('No se pudo cerrar el servicio');
      }
    }
  };

  // Batch close handler
  const handleBatchCloseServices = async () => {
    const selectedCount = selectedServiceIds.size;
    if (selectedCount === 0) return;

    // Only pending / in_progress are closeable
    const selectedData = services.filter(s => selectedServiceIds.has(s.id));
    const closeable = selectedData.filter(s => s.status === 'pending' || s.status === 'in_progress');
    const notCloseableCount = selectedCount - closeable.length;

    if (closeable.length === 0) {
      toast.error('No hay servicios pendientes o en progreso para cerrar');
      return;
    }

    const confirmed = window.confirm(
      `¿Estás seguro de que deseas cerrar ${closeable.length} servicio${closeable.length > 1 ? 's' : ''}?` +
      (notCloseableCount > 0 ? `\n\n(${notCloseableCount} seleccionado${notCloseableCount > 1 ? 's' : ''} no se puede${notCloseableCount > 1 ? 'n' : ''} cerrar por su estado)` : '')
    );

    if (!confirmed) return;

    setIsBatchClosing(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const service of closeable) {
        try {
          const { data, error } = await supabase.rpc('emergency_close_service', {
            p_service_id: service.id
          });

          if (error || !(data as any)?.success) {
            console.error(`Error closing service ${service.id}:`, error || (data as any)?.error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.error(`Error closing service ${service.id}:`, err);
          errorCount++;
        }
      }

      // Clear selection and refresh
      setSelectedServiceIds(new Set());
      await refetch();

      // Show result
      if (errorCount === 0) {
        toast.success(`${successCount} servicio${successCount > 1 ? 's' : ''} cerrado${successCount > 1 ? 's' : ''} exitosamente`);
      } else if (successCount === 0) {
        toast.error(`No se pudieron cerrar los servicios`);
      } else {
        toast.warning(`${successCount} cerrado${successCount > 1 ? 's' : ''}, ${errorCount} con error`);
      }
    } catch (error) {
      console.error('Error in batch close:', error);
      toast.error('Error al cerrar servicios por lotes');
    } finally {
      setIsBatchClosing(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedServiceIds(new Set());
  };

  const handleViewDetails = (service: Service) => {
    setSelectedService(service);
    setIsDetailsOpen(true);
  };

  const handleEdit = (service: Service) => {
    if (service.status === 'invoiced' && user?.role !== 'admin') {
      toast.error('No se puede editar un servicio facturado. Solo los administradores pueden hacerlo');
      return;
    }
    
    if (service.status === 'invoiced' && user?.role === 'admin') {
      if (!window.confirm(`⚠️ ADVERTENCIA: Este servicio está facturado.\n\nComo administrador puedes editarlo, pero ten cuidado con los cambios ya que puede afectar la facturación.\n\n¿Deseas continuar?`)) {
        return;
      }
    }
    
    setEditingService(service);
    setIsFormOpen(true);
  };

  const handleDelete = async (service: Service) => {
    if (service.status === 'invoiced') {
      toast.error('No se puede eliminar un servicio facturado');
      return;
    }

    if (confirm(`¿Estás seguro de que deseas eliminar el servicio ${service.folio}?`)) {
      try {
        await deleteService(service.id);
      } catch (error) {
        console.error('Error deleting service:', error);
      }
    }
  };

  const handleDuplicateService = (service: Service) => {
    const duplicatedData = prepareServiceForDuplication(service);
    setPrefilledData(duplicatedData);
    setEditingService(null);
    setSelectedService(null);
    setIsDetailsOpen(false);
    setIsFormOpen(true);
    toast.success(`Servicio ${service.folio} preparado para duplicación. Revisa y ajusta los campos necesarios.`);
  };

  const handleSort = (field: 'folio' | 'date' | 'client' | 'vehicle' | 'crane' | 'operator' | 'value' | 'status') => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortField(null);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleCSVSuccess = async (count: number) => {
    console.log('🎯 CSV Success handler - refreshing services...');
    setIsCSVUploadOpen(false);
    
    // Resetear filtros para mostrar todos los servicios
    setSearchTerm('');
    setStatusFilter('all');
    setAdvancedFilters(null);
    setSortField(null);
    setSortField(null);
    setSortDirection('asc');
    setCurrentPage(1);
    
    // Refrescar datos desde Supabase
    try {
      await refetch();
      console.log('✅ Services refreshed successfully after CSV upload');
      toast.success(`${count} servicios cargados exitosamente y lista actualizada`);
    } catch (error) {
      console.error('❌ Error refreshing services after CSV upload:', error);
      toast.success(`${count} servicios cargados exitosamente`);
      toast.error('Error al actualizar la lista. Refrescar la página.');
    }
  };

  return {
    // State
    services,
    loading,
    selectedService,
    isFormOpen,
    isDetailsOpen,
    isCSVUploadOpen,
    editingService,
    searchTerm,
    statusFilter,
    currentPage,
    refreshing,
    hasAdvancedFilters,
    isAdmin,
    filteredServices: filteredAndSortedServices,
    totalPages,
    paginatedServices,
    ITEMS_PER_PAGE,
    prefilledData,
    fromCalendarEvent,
    sortField,
    sortDirection,
    
    // Batch selection state
    selectedServiceIds,
    selectedServicesTotal,
    isBatchClosing,
    
    // Setters
    setSelectedService,
    setIsFormOpen,
    setIsDetailsOpen,
    setIsCSVUploadOpen,
    setEditingService,
    setSearchTerm,
    setStatusFilter,
    setCurrentPage,
    setSelectedServiceIds,
    
    // Handlers
    handleAdvancedFiltersChange,
    handleRefresh,
    handleCreateService,
    handleUpdateService,
    handleFormOpenChange,
    handleCloseService,
    handleBatchCloseServices,
    handleClearSelection,
    handleViewDetails,
    handleEdit,
    handleDelete,
    handleCSVSuccess,
    handleSort,
    handleDuplicateService,
  };
};
