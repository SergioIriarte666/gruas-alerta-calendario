
import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useServices } from '@/hooks/useServices';
import { useServiceManager } from './useServiceManager';
import { useUser } from '@/contexts/UserContext';
import { Service, ServiceStatus } from '@/types';
import { toast } from 'sonner';
import { isFutureDate } from '@/utils/timezoneUtils';
import { supabase } from '@/integrations/supabase/client';

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
  const [advancedFilterFunction, setAdvancedFilterFunction] = useState<((services: Service[]) => Service[]) | null>(null);
  const [hasAdvancedFilters, setHasAdvancedFilters] = useState(false);
  const [prefilledData, setPrefilledData] = useState<any>(null);
  const [fromCalendarEvent, setFromCalendarEvent] = useState(false);
  const [sortField, setSortField] = useState<'folio' | 'date' | 'client' | 'vehicle' | 'crane' | 'operator' | 'value' | 'status' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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

  const handleAdvancedFiltersChange = (hasFilters: boolean, filterFunction: (services: Service[]) => Service[]) => {
    setHasAdvancedFilters(hasFilters);
    setAdvancedFilterFunction(() => filterFunction);
    setCurrentPage(1);
  };

  const filteredAndSortedServices = (() => {
    let filtered = [];
    
    if (hasAdvancedFilters && advancedFilterFunction) {
      filtered = advancedFilterFunction(services);
    } else {
      filtered = services.filter(service => {
        const matchesSearch = 
          (service.folio || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (service.client?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (service.licensePlate || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (service.vehicleBrand || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (service.quoteNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (service.purchaseOrder || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (service.purchaseOrderNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const statusesToFilter = statusFilter === 'all' ? [] : statusFilter.split(',');
        let matchesStatus = false;
        
        if (statusFilter === 'all') {
          matchesStatus = true;
        } else if (statusFilter === 'with_purchase_order') {
          // Filtrar servicios que tienen orden de compra asignada (no vacía)
          matchesStatus = !!(
            (service.purchaseOrderNumber && service.purchaseOrderNumber.trim() !== '') ||
            (service.purchaseOrder && service.purchaseOrder.trim() !== '')
          );
        } else {
          matchesStatus = statusesToFilter.includes(service.status);
        }
        
        // Filtro para servicios futuros si se especifica el parámetro - FIXED: Solo filtrar si explicitly future=true
        const matchesFuture = futureParam !== 'true' || isFutureDate(service.serviceDate);
        
        // Debug: Log filtering for problematic services
        if (service.folio.includes('4019') || service.folio.includes('4020') || service.folio.includes('4022')) {
          console.log(`[FILTER DEBUG] Service ${service.folio}:`, {
            serviceDate: service.serviceDate,
            matchesSearch,
            matchesStatus,
            matchesFuture,
            futureParam,
            statusFilter,
            searchTerm
          });
        }
        
        return matchesSearch && matchesStatus && matchesFuture;
      });
    }

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
    setHasAdvancedFilters(false);
    setAdvancedFilterFunction(null);
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
    
    // Setters
    setSelectedService,
    setIsFormOpen,
    setIsDetailsOpen,
    setIsCSVUploadOpen,
    setEditingService,
    setSearchTerm,
    setStatusFilter,
    setCurrentPage,
    
    // Handlers
    handleAdvancedFiltersChange,
    handleRefresh,
    handleCreateService,
    handleUpdateService,
    handleFormOpenChange,
    handleCloseService,
    handleViewDetails,
    handleEdit,
    handleDelete,
    handleCSVSuccess,
    handleSort,
  };
};
