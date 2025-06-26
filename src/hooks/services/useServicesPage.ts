
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useServices } from '@/hooks/useServices';
import { useUser } from '@/contexts/UserContext';
import { Service } from '@/types';
import { toast } from 'sonner';

export const useServicesPage = () => {
  const { services, loading, createService, updateService, deleteService, refetch } = useServices();
  const { user } = useUser();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const statusParam = params.get('status');
  
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

  const isAdmin = user?.role === 'admin';
  const ITEMS_PER_PAGE = 10;

  const handleAdvancedFiltersChange = (hasFilters: boolean, filterFunction: (services: Service[]) => Service[]) => {
    setHasAdvancedFilters(hasFilters);
    setAdvancedFilterFunction(() => filterFunction);
    setCurrentPage(1);
  };

  const filteredServices = (() => {
    if (hasAdvancedFilters && advancedFilterFunction) {
      return advancedFilterFunction(services);
    }

    return services.filter(service => {
      const matchesSearch = 
        service.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (service.client?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.vehicleBrand.toLowerCase().includes(searchTerm.toLowerCase());
      
      const statusesToFilter = statusFilter === 'all' ? [] : statusFilter.split(',');
      const matchesStatus = statusFilter === 'all' || statusesToFilter.includes(service.status);
      
      return matchesSearch && matchesStatus;
    });
  })();

  const totalPages = Math.ceil(filteredServices.length / ITEMS_PER_PAGE);
  const paginatedServices = filteredServices.slice(
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

  const handleCreateService = async (serviceData: Omit<Service, 'id' | 'createdAt' | 'updatedAt'> & { folio: string }) => {
    try {
      await createService(serviceData);
      setIsFormOpen(false);
      setEditingService(null);
      toast.success('El servicio se ha creado exitosamente');
    } catch (error) {
      console.error('Error creating service:', error);
      toast.error('No se pudo crear el servicio');
    }
  };

  const handleUpdateService = async (serviceData: Omit<Service, 'id' | 'createdAt' | 'updatedAt'> & { folio: string }) => {
    if (editingService) {
      try {
        await updateService(editingService.id, serviceData);
        setEditingService(null);
        setIsFormOpen(false);
        toast.success('El servicio se ha actualizado exitosamente');
      } catch (error) {
        console.error('Error updating service:', error);
        toast.error('No se pudo actualizar el servicio');
      }
    }
  };

  const handleFormOpenChange = (open: boolean) => {
    if (!open) {
      setEditingService(null);
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
        await updateService(service.id, { status: 'completed' });
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
        toast.success('El servicio se ha eliminado exitosamente');
      } catch (error) {
        console.error('Error deleting service:', error);
        toast.error('No se pudo eliminar el servicio');
      }
    }
  };

  const handleCSVSuccess = (count: number) => {
    setIsCSVUploadOpen(false);
    toast.success(`${count} servicios cargados exitosamente`);
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
    filteredServices,
    totalPages,
    paginatedServices,
    ITEMS_PER_PAGE,
    
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
  };
};
