
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

export const ServicesPageContent = () => {
  const { services = [], loading, createService, updateService, deleteService } = useServices();
  const { toast } = useToast();
  
  // Estados del formulario
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  
  // Estados de diálogos
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCSVUploadOpen, setIsCSVUploadOpen] = useState(false);
  
  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    client: '',
    serviceType: '',
    operator: '',
    crane: '',
    dateRange: { from: '', to: '' }
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Función para abrir el formulario de nuevo servicio
  const handleNewService = () => {
    setEditingService(null);
    setIsFormOpen(true);
  };

  // Función para editar servicio
  const handleEditService = (service: Service) => {
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

  // Función para manejar éxito de carga CSV
  const handleCSVSuccess = (count: number) => {
    toast({
      type: 'success',
      title: 'Carga exitosa',
      description: `Se han cargado ${count} servicios correctamente`
    });
    setIsCSVUploadOpen(false);
  };

  // Aplicar filtros a los servicios
  const filteredServices = services.filter(service => {
    const matchesSearch = !searchTerm || 
      service.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.origin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.destination?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = !filters.status || service.status === filters.status;
    const matchesClient = !filters.client || service.client?.id === filters.client;
    const matchesServiceType = !filters.serviceType || service.serviceType?.id === filters.serviceType;
    const matchesOperator = !filters.operator || service.operator?.id === filters.operator;
    const matchesCrane = !filters.crane || service.crane?.id === filters.crane;

    return matchesSearch && matchesStatus && matchesClient && 
           matchesServiceType && matchesOperator && matchesCrane;
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
        onNewService={handleNewService}
        onCSVUpload={() => setIsCSVUploadOpen(true)}
        servicesCount={services.length}
      />

      <ServiceFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filters={filters}
        onFiltersChange={setFilters}
        showAdvancedFilters={showAdvancedFilters}
        onToggleAdvancedFilters={() => setShowAdvancedFilters(!showAdvancedFilters)}
      />

      {showAdvancedFilters && (
        <AdvancedServiceFilters
          filters={filters}
          onFiltersChange={setFilters}
        />
      )}

      <div className="block md:hidden">
        <ServicesMobileView
          services={filteredServices}
          onEditService={handleEditService}
          onViewService={handleViewService}
          onDeleteService={handleDeleteService}
        />
      </div>

      <div className="hidden md:block">
        <ServicesTable
          services={filteredServices}
          onEditService={handleEditService}
          onViewService={handleViewService}
          onDeleteService={handleDeleteService}
        />
      </div>

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
