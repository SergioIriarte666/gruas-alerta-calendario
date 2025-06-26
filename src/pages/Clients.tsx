import * as React from 'react';
import { useClients } from '@/hooks/useClients';
import { Client } from '@/types';
import { toast } from 'sonner';
import { ClientDetailsModal } from '@/components/clients/ClientDetailsModal';
import { AppPagination } from '@/components/shared/AppPagination';
import { ClientsHeader } from '@/components/clients/ClientsHeader';
import { ClientsFilters } from '@/components/clients/ClientsFilters';
import { ClientsTable } from '@/components/clients/ClientsTable';

const Clients = () => {
  const { clients, loading, createClient, updateClient, deleteClient, toggleClientStatus } = useClients();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedClient, setSelectedClient] = React.useState<Client | undefined>();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = React.useState(false);
  const [selectedClientForDetails, setSelectedClientForDetails] = React.useState<Client | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const ITEMS_PER_PAGE = 10;

  const filteredClients = React.useMemo(() => 
    clients.filter(client =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.rut.includes(searchTerm) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase())
    ), [clients, searchTerm]
  );

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
  const paginatedClients = React.useMemo(() => 
    filteredClients.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    ), [filteredClients, currentPage, ITEMS_PER_PAGE]
  );

  const handleCreateClient = React.useCallback((clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    createClient(clientData);
    setIsDialogOpen(false);
    toast.success("Cliente creado", {
      description: "El cliente ha sido creado exitosamente.",
    });
  }, [createClient]);

  const handleUpdateClient = React.useCallback((clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (selectedClient) {
      updateClient(selectedClient.id, clientData);
      setIsDialogOpen(false);
      setSelectedClient(undefined);
      toast.success("Cliente actualizado", {
        description: "Los datos del cliente han sido actualizados.",
      });
    }
  }, [selectedClient, updateClient]);

  const handleEditClient = React.useCallback((client: Client) => {
    setSelectedClient(client);
    setIsDialogOpen(true);
  }, []);

  const handleDeleteClient = React.useCallback((client: Client) => {
    if (window.confirm(`¿Estás seguro de eliminar al cliente "${client.name}"?`)) {
      deleteClient(client.id);
      toast.error("Cliente eliminado", {
        description: "El cliente ha sido eliminado del sistema.",
      });
    }
  }, [deleteClient]);

  const handleToggleStatus = React.useCallback((client: Client) => {
    toggleClientStatus(client.id);
    toast.info(client.isActive ? "Cliente desactivado" : "Cliente activado", {
      description: `El cliente ha sido ${client.isActive ? 'desactivado' : 'activado'}.`,
    });
  }, [toggleClientStatus]);

  const handleNewClient = React.useCallback(() => {
    setSelectedClient(undefined);
    setIsDialogOpen(true);
  }, []);

  const handleViewDetails = React.useCallback((client: Client) => {
    setSelectedClientForDetails(client);
    setIsDetailsModalOpen(true);
  }, []);

  const handleCloseDetailsModal = React.useCallback(() => {
    setIsDetailsModalOpen(false);
    setSelectedClientForDetails(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" style={{ backgroundColor: '#000000' }}>
        <div className="text-white">Cargando clientes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in min-h-screen" style={{ backgroundColor: '#000000', color: '#ffffff' }}>
      <ClientsHeader
        isDialogOpen={isDialogOpen}
        setIsDialogOpen={setIsDialogOpen}
        selectedClient={selectedClient}
        setSelectedClient={setSelectedClient}
        handleNewClient={handleNewClient}
        handleCreateClient={handleCreateClient}
        handleUpdateClient={handleUpdateClient}
      />

      <ClientsFilters searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

      <ClientsTable
        clients={paginatedClients}
        totalClients={filteredClients.length}
        onEdit={handleEditClient}
        onDelete={handleDeleteClient}
        onToggleStatus={handleToggleStatus}
        onViewDetails={handleViewDetails}
        onNewClient={handleNewClient}
        searchTerm={searchTerm}
      />
      
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
          onClose={handleCloseDetailsModal}
        />
      )}
    </div>
  );
};

export default Clients;
