
import React, { useState } from 'react';
import { useServiceTypesManagement } from '@/hooks/useServiceTypesManagement';
import { ServiceTypeConfig } from '@/types/serviceTypes';
import { ServiceTypesHeader } from '@/components/service-types/ServiceTypesHeader';
import { ServiceTypesTable } from '@/components/service-types/ServiceTypesTable';
import { ServiceTypeForm } from '@/components/service-types/ServiceTypeForm';
import { ServiceTypeDetailsModal } from '@/components/service-types/ServiceTypeDetailsModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Search } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { createLogger } from "@/lib/logger";

const logger = createLogger("ServiceTypes");

const ServiceTypes = () => {
  const { user } = useUser();
  const { serviceTypes, loading, createServiceType, updateServiceType, deleteServiceType, refetch } = useServiceTypesManagement();
  const [selectedServiceType, setSelectedServiceType] = useState<ServiceTypeConfig | null>(null);
  const [editingServiceType, setEditingServiceType] = useState<ServiceTypeConfig | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceTypeToDelete, setServiceTypeToDelete] = useState<ServiceTypeConfig | null>(null);

  React.useEffect(() => {
    document.title = 'Tipos de Servicio | Panel';
    const meta = document.querySelector('meta[name="description"]');
    const content = 'Gestiona los tipos de servicio y sus configuraciones del sistema.';
    if (meta) meta.setAttribute('content', content);
    else { const m = document.createElement('meta'); m.name = 'description'; m.content = content; document.head.appendChild(m); }
    if (!document.querySelector('link[rel="canonical"]')) {
      const l = document.createElement('link'); l.rel = 'canonical'; l.href = window.location.href; document.head.appendChild(l);
    }
  }, []);

  const isAdmin = user?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Acceso Restringido</h2>
          <p className="text-muted-foreground">Solo los administradores pueden gestionar tipos de servicio.</p>
          <p className="text-muted-foreground text-sm mt-2">Tu rol actual: {user?.role || 'No definido'}</p>
        </div>
      </div>
    );
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      toast.success('Datos actualizados correctamente');
    } catch (error) {
      logger.error('Error refreshing:', error);
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
    setServiceTypeToDelete(serviceType);
  };

  const confirmDelete = async () => {
    if (!serviceTypeToDelete) return;
    try {
      await deleteServiceType(serviceTypeToDelete.id);
      toast.success('Tipo de servicio eliminado', {
        description: `"${serviceTypeToDelete.name}" fue eliminado correctamente.`,
      });
    } catch (error) {
      logger.error('Error deleting service type:', error);
      toast.error('No se pudo eliminar el tipo de servicio');
    } finally {
      setServiceTypeToDelete(null);
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
      logger.error('Error submitting form:', error);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingServiceType(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-muted-foreground">Cargando tipos de servicio...</div>
      </div>
    );
  }

  // Filter service types based on search term
  const filteredServiceTypes = serviceTypes.filter(serviceType =>
    serviceType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (serviceType.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <ServiceTypesHeader
        onNewServiceType={handleNewServiceType}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* Search Bar */}
      <Card className="bg-card border">
        <CardContent className="p-3 sm:p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
            <input
              type="text"
              placeholder="Buscar tipos de servicio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border rounded-lg text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none text-sm"
            />
          </div>
        </CardContent>
      </Card>

      <ServiceTypesTable
        serviceTypes={filteredServiceTypes}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-card border p-0 gap-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-foreground text-xl">
              {editingServiceType ? 'Editar' : 'Crear'} Tipo de Servicio
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-4">
            <ServiceTypeForm
              serviceType={editingServiceType}
              onSubmit={handleFormSubmit}
              onCancel={handleFormClose}
            />
          </div>
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

      <AlertDialog open={!!serviceTypeToDelete} onOpenChange={(open) => !open && setServiceTypeToDelete(null)}>
        <AlertDialogContent className="border-border/70 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar tipo de servicio</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente el tipo de servicio{' '}
              <span className="font-medium text-foreground">
                {serviceTypeToDelete?.name}
              </span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ServiceTypes;
