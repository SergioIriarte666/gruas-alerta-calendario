import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, Filter, Edit, Trash2, Power, Eye } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { ClientForm } from '@/components/clients/ClientForm';
import { Client } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { ClientDetailsModal } from '@/components/clients/ClientDetailsModal';
import { AppPagination } from '@/components/shared/AppPagination';

const Clients = () => {
  const { clients, loading, createClient, updateClient, deleteClient, toggleClientStatus } = useClients();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | undefined>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedClientForDetails, setSelectedClientForDetails] = useState<Client | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.rut.includes(searchTerm) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleCreateClient = (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    createClient(clientData);
    setIsDialogOpen(false);
    toast({
      title: "Cliente creado",
      description: "El cliente ha sido creado exitosamente.",
    });
  };

  const handleUpdateClient = (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (selectedClient) {
      updateClient(selectedClient.id, clientData);
      setIsDialogOpen(false);
      setSelectedClient(undefined);
      toast({
        title: "Cliente actualizado",
        description: "Los datos del cliente han sido actualizados.",
      });
    }
  };

  const handleEditClient = (client: Client) => {
    setSelectedClient(client);
    setIsDialogOpen(true);
  };

  const handleDeleteClient = (client: Client) => {
    if (window.confirm(`¿Estás seguro de eliminar al cliente "${client.name}"?`)) {
      deleteClient(client.id);
      toast({
        title: "Cliente eliminado",
        description: "El cliente ha sido eliminado del sistema.",
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = (client: Client) => {
    toggleClientStatus(client.id);
    toast({
      title: client.isActive ? "Cliente desactivado" : "Cliente activado",
      description: `El cliente ha sido ${client.isActive ? 'desactivado' : 'activado'}.`,
    });
  };

  const handleNewClient = () => {
    setSelectedClient(undefined);
    setIsDialogOpen(true);
  };

  const handleViewDetails = (client: Client) => {
    setSelectedClientForDetails(client);
    setIsDetailsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Cargando clientes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Gestión de Clientes</h1>
          <p className="text-gray-400 mt-2">
            Administra la información de todos los clientes del sistema
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={handleNewClient}
              className="bg-tms-green hover:bg-tms-green-dark text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Cliente
            </Button>
          </DialogTrigger>
          <ClientForm
            client={selectedClient}
            onSubmit={selectedClient ? handleUpdateClient : handleCreateClient}
            onCancel={() => {
              setIsDialogOpen(false);
              setSelectedClient(undefined);
            }}
          />
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por nombre, RUT o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/5 border-gray-700 text-white placeholder-gray-400 focus:border-tms-green"
                />
              </div>
            </div>
            <Button variant="outline" className="border-gray-700 text-gray-300 hover:text-white">
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Clients Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-white">
            Clientes Registrados ({filteredClients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredClients.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="w-16 h-16 bg-tms-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-tms-green" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
              </h3>
              <p className="text-gray-400 mb-6">
                {searchTerm 
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Comienza agregando tu primer cliente'
                }
              </p>
              {!searchTerm && (
                <Button 
                  onClick={handleNewClient}
                  className="bg-tms-green hover:bg-tms-green-dark text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Primer Cliente
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-300">Cliente</TableHead>
                    <TableHead className="text-gray-300">RUT</TableHead>
                    <TableHead className="text-gray-300">Contacto</TableHead>
                    <TableHead className="text-gray-300">Dirección</TableHead>
                    <TableHead className="text-gray-300">Estado</TableHead>
                    <TableHead className="text-gray-300">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedClients.map((client) => (
                    <TableRow key={client.id} className="border-gray-700 hover:bg-white/5">
                      <TableCell>
                        <div className="font-medium text-white">{client.name}</div>
                      </TableCell>
                      <TableCell className="text-gray-300">{client.rut}</TableCell>
                      <TableCell>
                        <div className="text-gray-300">
                          <div>{client.phone}</div>
                          <div className="text-sm text-gray-400">{client.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300 max-w-xs truncate">
                        {client.address}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={client.isActive ? "default" : "secondary"}
                          className={client.isActive 
                            ? "bg-tms-green/20 text-tms-green border-tms-green/30" 
                            : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                          }
                        >
                          {client.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(client)}
                            className="text-gray-400 hover:text-white hover:bg-white/10"
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClient(client)}
                            className="text-gray-400 hover:text-white hover:bg-white/10"
                            title="Editar cliente"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(client)}
                            className="text-gray-400 hover:text-white hover:bg-white/10"
                            title={client.isActive ? 'Desactivar cliente' : 'Activar cliente'}
                          >
                            <Power className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClient(client)}
                            className="text-gray-400 hover:text-red-400 hover:bg-red-400/10"
                            title="Eliminar cliente"
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
      <AppPagination 
        className="py-4"
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
      {selectedClientForDetails && (
        <ClientDetailsModal
          client={selectedClientForDetails}
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedClientForDetails(null);
          }}
        />
      )}
    </div>
  );
};

export default Clients;
