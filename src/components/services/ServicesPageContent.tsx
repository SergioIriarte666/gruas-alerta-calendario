
import React, { useState } from 'react';
import { Service } from '@/types';
import { useServices } from '@/hooks/useServices';
import { ServicesHeader } from './ServicesHeader';
import { ServicesTable } from './ServicesTable';
import { ServicesMobileView } from './ServicesMobileView';
import { ServicesDialogs } from './ServicesDialogs';
import { ServiceFilters } from './ServiceFilters';
import { AdvancedServiceFilters } from './AdvancedServiceFilters';
import { useToast } from '@/components/ui/custom-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/contexts/UserContext';
import { useIsMobile } from '@/hooks/use-mobile';

export const ServicesPageContent = () => {
  const { services = [], loading, createService, updateService, deleteService, refetch } = useServices();
  const { toast } = useToast();
  const { user } = useUser();
  const isMobile = useIsMobile();
  
  // Estados del formulario
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  
  // Estados de diálogos
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCSVUploadOpen, setIsCSVUploadOpen] = useState(false);
  
  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = user?.role === 'admin';

  // Función para abrir el formulario de nuevo servicio
  const handleNewService = () => {
    setEditingService(null);
    setIsFormOpen(true);
  };

  // Función para editar servicio
  const handleEditService = (service: Service) => {
    if (service.status === 'invoiced' && !isAdmin) {
      toast({
        type: 'error',
        title: 'Error',
        description: 'No se puede editar un servicio facturado. Solo los administradores pueden hacerlo.'
      });
      return;
    }
    setEditingService(service);
    setIsFormOpen(true);
  };

  // Función para ver detalles del servicio
  const handleViewService = (service: Service) => {
    setSelectedService(service);
    setIsDetailsOpen(true);
  };

  // Función para crear servicio
  const handleCreateService = async (serviceData: any) => {
    try {
      await createService(serviceData);
      setIsFormOpen(false);
      toast({
        type: 'success',
        title: 'Servicio creado',
        description: 'El servicio se ha creado correctamente'
      });
    } catch (error) {
      console.error('Error creating service:', error);
      toast({
        type: 'error',
        title: 'Error',
        description: 'No se pudo crear el servicio'
      });
    }
  };

  // Función para actualizar servicio
  const handleUpdateService = async (serviceData: any) => {
    try {
      if (editingService?.id) {
        await updateService(editingService.id, serviceData);
        setIsFormOpen(false);
        setEditingService(null);
        toast({
          type: 'success',
          title: 'Servicio actualizado',
          description: 'El servicio se ha actualizado correctamente'
        });
      }
    } catch (error) {
      console.error('Error updating service:', error);
      toast({
        type: 'error',
        title: 'Error',
        description: 'No se pudo actualizar el servicio'
      });
    }
  };

  // Función para eliminar servicio
  const handleDeleteService = async (serviceId: string) => {
    try {
      await deleteService(serviceId);
      toast({
        type: 'success',
        title: 'Servicio eliminado',
        description: 'El servicio se ha eliminado correctamente'
      });
    } catch (error) {
      console.error('Error deleting service:', error);
      toast({
        type: 'error',
        title: 'Error',
        description: 'No se pudo eliminar el servicio'
      });
    }
  };

  // Función para cerrar servicio
  const handleCloseService = async (service: Service) => {
    if (service.status === 'invoiced') {
      toast({
        type: 'error',
        title: 'Error',
        description: 'No se puede cerrar un servicio que ya está facturado'
      });
      return;
    }

    if (window.confirm(`¿Estás seguro de que deseas cerrar el servicio ${service.folio}?`)) {
      try {
        await updateService(service.id, { status: 'completed' });
        toast({
          type: 'success',
          title: 'Servicio cerrado',
          description: 'El servicio se ha cerrado exitosamente'
        });
      } catch (error) {
        console.error('Error closing service:', error);
        toast({
          type: 'error',
          title: 'Error',
          description: 'No se pudo cerrar el servicio'
        });
      }
    }
  };

  // Función para manejar éxito de carga CSV
  const handleCSVSuccess = (count: number) => {
    toast({
      type: 'success',
      title: 'Carga exitosa',
      description: `Se han cargado ${count} servicios correctamente`
    });
    setIsCSVUploadOpen(false);
  };

  // Función para actualizar datos
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      toast({
        type: 'success',
        title: 'Datos actualizados',
        description: 'Los datos se han actualizado correctamente'
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({
        type: 'error',
        title: 'Error',
        description: 'No se pudieron actualizar los datos'
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Aplicar filtros a los servicios
  const filteredServices = services.filter(service => {
    const matchesSearch = !searchTerm || 
      service.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.origin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.destination?.toLowerCase().includes(searchTerm.toLowerCase());

    const statusesToFilter = statusFilter === 'all' ? [] : statusFilter.split(',');
    const matchesStatus = statusFilter === 'all' || statusesToFilter.includes(service.status);

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-8 w-64" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ServicesHeader 
        isAdmin={isAdmin}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onCSVUpload={() => setIsCSVUploadOpen(true)}
        onNewService={handleNewService}
      />

      <ServiceFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        showAdvancedFilters={false}
        onToggleAdvancedFilters={() => {}}
      />

      {isMobile ? (
        <ServicesMobileView
          services={filteredServices}
          hasInitialServices={services.length > 0}
          onViewDetails={handleViewService}
          onEdit={isAdmin ? handleEditService : undefined}
          onDelete={isAdmin ? handleDeleteService : undefined}
          onCloseService={handleCloseService}
          onAddNewService={isAdmin ? handleNewService : undefined}
        />
      ) : (
        <ServicesTable
          services={filteredServices}
          hasInitialServices={services.length > 0}
          onViewDetails={handleViewService}
          onEdit={isAdmin ? handleEditService : undefined}
          onDelete={isAdmin ? handleDeleteService : undefined}
          onCloseService={handleCloseService}
          onAddNewService={isAdmin ? handleNewService : undefined}
        />
      )}

      <ServicesDialogs
        isCSVUploadOpen={isCSVUploadOpen}
        onCSVUploadClose={() => setIsCSVUploadOpen(false)}
        onCSVSuccess={handleCSVSuccess}
        isFormOpen={isFormOpen}
        onFormOpenChange={setIsFormOpen}
        editingService={editingService}
        onCreateService={handleCreateService}
        onUpdateService={handleUpdateService}
        selectedService={selectedService}
        isDetailsOpen={isDetailsOpen}
        onDetailsClose={() => setIsDetailsOpen(false)}
      />
    </div>
  );
};
