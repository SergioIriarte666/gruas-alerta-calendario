import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Upload, RefreshCw } from 'lucide-react';
import { useServices } from '@/hooks/useServices';
import { Service } from '@/types';
import { ServiceForm } from '@/components/services/ServiceForm';
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';
import { ServiceFilters } from '@/components/services/ServiceFilters';
import { CSVUploadServices } from '@/components/services/CSVUploadServices';
import { ServicesTable } from '@/components/services/ServicesTable';
import { AppPagination } from '@/components/shared/AppPagination';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/components/ui/custom-toast';

const Services = () => {
  const { services, loading, createService, updateService, deleteService, refetch } = useServices();
  const { user } = useUser();
  const { toast } = useToast();
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
      toast({
        type: "success",
        title: "Datos actualizados",
        description: "La lista de servicios se ha actualizado correctamente.",
      });
    } catch (error) {
      toast({
        type: "error",
        title: "Error",
        description: "No se pudieron actualizar los datos.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateService = (serviceData: Omit<Service, 'id' | 'createdAt' | 'updatedAt'> & { folio: string }) => {
    createService(serviceData);
    setIsFormOpen(false);
    setEditingService(null);
  };

  const handleUpdateService = (serviceData: Omit<Service, 'id' | 'createdAt' | 'updatedAt'> & { folio: string }) => {
    if (editingService) {
      updateService(editingService.id, serviceData);
      setEditingService(null);
      setIsFormOpen(false);
    }
  };

  const handleFormOpenChange = (open: boolean) => {
    if (!open) {
      setEditingService(null);
    }
    setIsFormOpen(open);
  };

  const handleCloseService = (service: Service) => {
    if (service.status === 'invoiced') {
      toast({
        type: "error",
        title: "Error",
        description: "No se puede cerrar un servicio que ya está facturado.",
      });
      return;
    }

    if (window.confirm(`¿Estás seguro de que deseas cerrar el servicio ${service.folio}? El estado cambiará a "Completado".`)) {
      updateService(service.id, { status: 'completed' });
    }
  };

  const handleViewDetails = (service: Service) => {
    setSelectedService(service);
    setIsDetailsOpen(true);
  };

  const handleEdit = (service: Service) => {
    // Administrators can edit invoiced services, but show a warning
    if (service.status === 'invoiced' && user?.role !== 'admin') {
      toast({
        type: "error",
        title: "Error",
        description: "No se puede editar un servicio facturado. Solo los administradores pueden hacerlo.",
      });
      return;
    }
    
    // Show warning for admins editing invoiced services
    if (service.status === 'invoiced' && user?.role === 'admin') {
      if (!window.confirm(`⚠️ ADVERTENCIA: Este servicio está facturado.\n\nComo administrador puedes editarlo, pero ten cuidado con los cambios ya que puede afectar la facturación.\n\n¿Deseas continuar?`)) {
        return;
      }
    }
    
    setEditingService(service);
    setIsFormOpen(true);
  };

  const handleDelete = (service: Service) => {
    if (service.status === 'invoiced') {
      toast({
        type: "error",
        title: "Error",
        description: "No se puede eliminar un servicio facturado.",
      });
      return;
    }

    if (confirm(`¿Estás seguro de que deseas eliminar el servicio ${service.folio}?`)) {
      deleteService(service.id);
    }
  };

  const handleCSVSuccess = (count: number) => {
    setIsCSVUploadOpen(false);
    console.log(`${count} servicios cargados exitosamente`);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Gestión de Servicios</h1>
          <p className="text-gray-400 mt-2">
            Administra todos los servicios de grúa del sistema
          </p>
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          {isAdmin && (
            <>
              <Button 
                onClick={() => setIsCSVUploadOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                title="Cargar servicios desde un archivo CSV"
              >
                <Upload className="w-4 h-4 mr-2" />
                Carga Masiva
              </Button>
              <Button 
                className="bg-tms-green hover:bg-tms-green-dark text-white"
                title="Crear un nuevo servicio"
                onClick={() => {
                  setEditingService(null);
                  setIsFormOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Servicio
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog open={isCSVUploadOpen} onOpenChange={setIsCSVUploadOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Carga Masiva de Servicios</DialogTitle>
          </DialogHeader>
          <CSVUploadServices
            onClose={() => setIsCSVUploadOpen(false)}
            onSuccess={handleCSVSuccess}
          />
        </DialogContent>
      </Dialog>
      
      {isAdmin && (
         <Dialog open={isFormOpen} onOpenChange={handleFormOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingService ? 'Editar Servicio' : 'Nuevo Servicio'}
                </DialogTitle>
              </DialogHeader>
              <ServiceForm
                service={editingService}
                onSubmit={editingService ? handleUpdateService : handleCreateService}
                onCancel={() => handleFormOpenChange(false)}
              />
            </DialogContent>
          </Dialog>
      )}

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

      {selectedService && (
        <ServiceDetailsModal
          service={selectedService}
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedService(null);
          }}
        />
      )}
    </div>
  );
};

export default Services;
