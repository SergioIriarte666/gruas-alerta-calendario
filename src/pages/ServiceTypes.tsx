import { useState } from 'react';
import { useServiceTypesManagement } from '@/hooks/useServiceTypesManagement';
import { ServiceTypeConfig } from '@/types/serviceTypes';
import { ServiceTypesHeader } from '@/components/service-types/ServiceTypesHeader';
import { ServiceTypesTable } from '@/components/service-types/ServiceTypesTable';
import { ServiceTypeForm } from '@/components/service-types/ServiceTypeForm';
import { ServiceTypeDetailsModal } from '@/components/service-types/ServiceTypeDetailsModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';

const ServiceTypes = () => {
  const { user } = useUser();
  const { serviceTypes, loading, createServiceType, updateServiceType, deleteServiceType, refetch } = useServiceTypesManagement();
  const [selectedServiceType, setSelectedServiceType] = useState<ServiceTypeConfig | null>(null);
  const [editingServiceType, setEditingServiceType] = useState<ServiceTypeConfig | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  console.log('ServiceTypes page: user role:', user?.role);
  const isAdmin = user?.role === 'admin';
  console.log('ServiceTypes page: isAdmin:', isAdmin);

  if (!isAdmin) {
    console.log('ServiceTypes: User is not admin, showing access denied');
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Acceso Restringido</h2>
          <p className="text-gray-400">Solo los administradores pueden gestionar tipos de servicio.</p>
          <p className="text-gray-500 text-sm mt-2">Tu rol actual: {user?.role || 'No definido'}</p>
        </div>
      </div>
    );
  }

  console.log('ServiceTypes: User is admin, showing main content');

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      toast.success('Datos actualizados correctamente');
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleNewServiceType = () => {
    setEditingServiceType(null);
    setIsFormOpen(true);
  };

  const handleEdit = (serviceType: ServiceTypeConfig) => {
    setEditingServiceType(serviceType);
    setIsFormOpen(true);
  };

  const handleView = (serviceType: ServiceTypeConfig) => {
    setSelectedServiceType(serviceType);
    setIsDetailsOpen(true);
  };

  const handleDelete = async (serviceType: ServiceTypeConfig) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el tipo de servicio "${serviceType.name}"?`)) {
      return;
    }

    try {
      await deleteServiceType(serviceType.id);
    } catch (error) {
      console.error('Error deleting service type:', error);
    }
  };

  const handleFormSubmit = async (data: any) => {
    try {
      if (editingServiceType) {
        await updateServiceType(editingServiceType.id, data);
      } else {
        await createServiceType(data);
      }
      setIsFormOpen(false);
      setEditingServiceType(null);
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingServiceType(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-white">Cargando tipos de servicio...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <ServiceTypesHeader
        onNewServiceType={handleNewServiceType}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      <ServiceTypesTable
        serviceTypes={serviceTypes}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingServiceType ? 'Editar' : 'Crear'} Tipo de Servicio
            </DialogTitle>
          </DialogHeader>
          <ServiceTypeForm
            serviceType={editingServiceType}
            onSubmit={handleFormSubmit}
            onCancel={handleFormClose}
          />
        </DialogContent>
      </Dialog>

      <ServiceTypeDetailsModal
        serviceType={selectedServiceType}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedServiceType(null);
        }}
      />
    </div>
  );
};

export default ServiceTypes;
