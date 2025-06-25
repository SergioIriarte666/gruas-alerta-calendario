import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useServices } from '@/hooks/useServices';
import { Service } from '@/types';
import { ServiceFilters } from '@/components/services/ServiceFilters';
import { ServicesTable } from '@/components/services/ServicesTable';
import { ServicesHeader } from '@/components/services/ServicesHeader';
import { ServicesDialogs } from '@/components/services/ServicesDialogs';
import { AppPagination } from '@/components/shared/AppPagination';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';

const Services = () => {
  const { services, loading, createService, updateService, deleteService, refetch } = useServices();
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';
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
  const ITEMS_PER_PAGE = 10;

  const filteredServices = services.filter(service => {
    const matchesSearch = 
      service.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (service.client?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.vehicleBrand.toLowerCase().includes(searchTerm.toLowerCase());
    
    const statusesToFilter = statusFilter === 'all' ? [] : statusFilter.split(',');
    const matchesStatus = statusFilter === 'all' || statusesToFilter.includes(service.status);
    
    return matchesSearch && matchesStatus;
  });

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-white">Cargando servicios...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <ServicesHeader
        isAdmin={isAdmin}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onCSVUpload={() => setIsCSVUploadOpen(true)}
        onNewService={() => {
          setEditingService(null);
          setIsFormOpen(true);
        }}
      />

      <ServicesDialogs
        isCSVUploadOpen={isCSVUploadOpen}
        onCSVUploadClose={() => setIsCSVUploadOpen(false)}
        onCSVSuccess={handleCSVSuccess}
        isFormOpen={isFormOpen}
        onFormOpenChange={handleFormOpenChange}
        editingService={editingService}
        onCreateService={handleCreateService}
        onUpdateService={handleUpdateService}
        selectedService={selectedService}
        isDetailsOpen={isDetailsOpen}
        onDetailsClose={() => {
          setIsDetailsOpen(false);
          setSelectedService(null);
        }}
      />
      
      <ServiceFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
      />

      <ServicesTable
        services={paginatedServices}
        hasInitialServices={services.length > 0}
        onViewDetails={handleViewDetails}
        onEdit={isAdmin ? handleEdit : undefined}
        onDelete={isAdmin ? handleDelete : undefined}
        onCloseService={isAdmin ? handleCloseService : undefined}
        onAddNewService={isAdmin ? () => setIsFormOpen(true) : undefined}
      />

      <AppPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
};

export default Services;
