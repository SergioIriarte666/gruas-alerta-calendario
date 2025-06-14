import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Filter, Eye, Edit, Trash2, Truck, FileText, Upload, Check } from 'lucide-react';
import { useServices } from '@/hooks/useServices';
import { Service } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ServiceForm } from '@/components/services/ServiceForm';
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';
import { ServiceFilters } from '@/components/services/ServiceFilters';
import { CSVUploadServices } from '@/components/services/CSVUploadServices';

const Services = () => {
  const { services, loading, createService, updateService, deleteService } = useServices();
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCSVUploadOpen, setIsCSVUploadOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const getStatusBadge = (status: Service['status']) => {
    const statusConfig = {
      pending: { label: 'Pendiente', className: 'bg-yellow-500 text-white' },
      in_progress: { label: 'En Progreso', className: 'bg-blue-500 text-white' },
      completed: { label: 'Completado', className: 'bg-green-500 text-white' },
      cancelled: { label: 'Cancelado', className: 'bg-red-500 text-white' }
    };

    const config = statusConfig[status] || { label: 'Desconocido', className: 'bg-gray-500 text-white' };

    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const filteredServices = services.filter(service => {
    const matchesSearch = 
      service.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.vehicleBrand.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || service.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleCreateService = (serviceData: Omit<Service, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => {
    createService(serviceData);
    setIsFormOpen(false);
  };

  const handleUpdateService = (serviceData: Omit<Service, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => {
    if (editingService) {
      updateService(editingService.id, serviceData);
      setEditingService(null);
      setIsFormOpen(false);
    }
  };

  const handleCloseService = (service: Service) => {
    if (window.confirm(`¿Estás seguro de que deseas cerrar el servicio ${service.folio}? El estado cambiará a "Completado".`)) {
      updateService(service.id, { status: 'completed' });
    }
  };

  const handleViewDetails = (service: Service) => {
    setSelectedService(service);
    setIsDetailsOpen(true);
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setIsFormOpen(true);
  };

  const handleDelete = (service: Service) => {
    if (confirm(`¿Estás seguro de que deseas eliminar el servicio ${service.folio}?`)) {
      deleteService(service.id);
    }
  };

  const handleCSVSuccess = (count: number) => {
    setIsCSVUploadOpen(false);
    // Could add a toast notification here
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Gestión de Servicios</h1>
          <p className="text-gray-400 mt-2">
            Administra todos los servicios de grúa del sistema
          </p>
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={() => setIsCSVUploadOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            title="Cargar servicios desde un archivo CSV"
          >
            <Upload className="w-4 h-4 mr-2" />
            Carga Masiva
          </Button>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-tms-green hover:bg-tms-green-dark text-white"
                title="Crear un nuevo servicio"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Servicio
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingService ? 'Editar Servicio' : 'Nuevo Servicio'}
                </DialogTitle>
              </DialogHeader>
              <ServiceForm
                service={editingService}
                onSubmit={editingService ? handleUpdateService : handleCreateService}
                onCancel={() => {
                  setIsFormOpen(false);
                  setEditingService(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* CSV Upload Modal */}
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

      {/* Filters */}
      <ServiceFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
      />

      {/* Services Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
            <Truck className="w-5 h-5 text-tms-green" />
            <span>Servicios Registrados ({filteredServices.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredServices.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="w-16 h-16 bg-tms-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="w-8 h-8 text-tms-green" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                {services.length === 0 ? 'No hay servicios registrados' : 'No hay servicios que coincidan con los filtros'}
              </h3>
              <p className="text-gray-400 mb-6">
                {services.length === 0 
                  ? 'Comienza agregando tu primer servicio de grúa'
                  : 'Intenta ajustar los filtros de búsqueda'
                }
              </p>
              {services.length === 0 && (
                <Button 
                  className="bg-tms-green hover:bg-tms-green-dark text-white"
                  onClick={() => setIsFormOpen(true)}
                  title="Crear el primer servicio"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Primer Servicio
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-300">Folio</TableHead>
                    <TableHead className="text-gray-300">Fecha Servicio</TableHead>
                    <TableHead className="text-gray-300">Cliente</TableHead>
                    <TableHead className="text-gray-300">Vehículo</TableHead>
                    <TableHead className="text-gray-300">Origen/Destino</TableHead>
                    <TableHead className="text-gray-300">Grúa</TableHead>
                    <TableHead className="text-gray-300">Operador</TableHead>
                    <TableHead className="text-gray-300">Valor</TableHead>
                    <TableHead className="text-gray-300">Estado</TableHead>
                    <TableHead className="text-gray-300">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.map((service) => (
                    <TableRow key={service.id} className="border-gray-700 hover:bg-white/5">
                      <TableCell className="font-medium text-tms-green">
                        {service.folio}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {format(new Date(service.serviceDate), 'dd/MM/yyyy', { locale: es })}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        <div className="font-medium">{service.client.name}</div>
                        <div className="text-sm text-gray-500">{service.client.rut}</div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        <div className="font-medium">{service.vehicleBrand} {service.vehicleModel}</div>
                        <div className="text-sm text-gray-500">{service.licensePlate}</div>
                      </TableCell>
                      <TableCell className="text-gray-300 max-w-48">
                        <div className="truncate">{service.origin}</div>
                        <div className="text-sm text-gray-500 truncate">→ {service.destination}</div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {service.crane.licensePlate}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {service.operator.name}
                      </TableCell>
                      <TableCell className="text-gray-300 font-medium">
                        {formatCurrency(service.value)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(service.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          {(service.status === 'pending' || service.status === 'in_progress') && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-green-400 hover:text-green-300 hover:bg-green-400/10"
                              onClick={() => handleCloseService(service)}
                              title="Cerrar Servicio"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-tms-green hover:text-tms-green-light hover:bg-tms-green/10"
                            onClick={() => handleViewDetails(service)}
                            title="Ver detalles del servicio"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                            onClick={() => handleEdit(service)}
                            title="Editar servicio"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                            onClick={() => handleDelete(service)}
                            title="Eliminar servicio"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Details Modal */}
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
