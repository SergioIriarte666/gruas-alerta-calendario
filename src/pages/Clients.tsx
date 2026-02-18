import * as React from 'react';
import { useClients, usePagedClients } from '@/hooks/useClients';
import { useClientsDashboardMetrics } from '@/hooks/useClientsDashboardMetrics';
import { Client } from '@/types';
import { toast } from 'sonner';
import { ClientDetailsModal } from '@/components/clients/ClientDetailsModal';
import { AppPagination } from '@/components/shared/AppPagination';
import { ClientsHeader } from '@/components/clients/ClientsHeader';
import { ClientsFilters, StatusFilter } from '@/components/clients/ClientsFilters';
import { ClientsTable, ClientSortField, SortDirection } from '@/components/clients/ClientsTable';
import { ClientsDashboard } from '@/components/clients/ClientsDashboard';

const Clients = () => {
  const { clients, loading, createClient, updateClient, deleteClient, toggleClientStatus } = useClients();
  const { metrics, serviceCountByClient } = useClientsDashboardMetrics(clients);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [selectedDepartment, setSelectedDepartment] = React.useState('');
  const [selectedClient, setSelectedClient] = React.useState<Client | undefined>();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = React.useState(false);
  const [selectedClientForDetails, setSelectedClientForDetails] = React.useState<Client | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortField, setSortField] = React.useState<ClientSortField>('name');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('asc');
  const ITEMS_PER_PAGE = 50;

  const isBasicView = searchTerm === '' && statusFilter === 'all' && selectedDepartment === '';

  const { data: pagedData, isLoading: pagedLoading } = usePagedClients(
    currentPage,
    ITEMS_PER_PAGE
  );

  const baseClients = isBasicView && pagedData?.clients ? pagedData.clients : clients;

  // Unique departments for filter
  const departments = React.useMemo(() => {
    const depts = new Set(clients.map(c => c.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [clients]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, selectedDepartment]);

  const handleSort = React.useCallback((field: ClientSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField, sortDirection]);

  const filteredAndSortedClients = React.useMemo(() => {
    let filtered = baseClients.filter(client =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.rut.includes(searchTerm) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Status filter
    if (statusFilter === 'active') filtered = filtered.filter(c => c.isActive);
    if (statusFilter === 'inactive') filtered = filtered.filter(c => !c.isActive);

    // Department filter
    if (selectedDepartment) filtered = filtered.filter(c => c.department === selectedDepartment);

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name': comparison = a.name.localeCompare(b.name); break;
        case 'rut': comparison = a.rut.localeCompare(b.rut); break;
        case 'department': comparison = a.department.localeCompare(b.department); break;
        case 'contactName': comparison = (a.contactName || '').localeCompare(b.contactName || ''); break;
        case 'email': comparison = a.email.localeCompare(b.email); break;
        case 'phone': comparison = a.phone.localeCompare(b.phone); break;
        case 'isActive': comparison = (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0); break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [baseClients, searchTerm, sortField, sortDirection, statusFilter, selectedDepartment]);

  const totalPages = React.useMemo(() => {
    if (isBasicView && pagedData) return Math.ceil(pagedData.total / ITEMS_PER_PAGE);
    return Math.ceil(filteredAndSortedClients.length / ITEMS_PER_PAGE);
  }, [isBasicView, pagedData, filteredAndSortedClients.length, ITEMS_PER_PAGE]);

  const paginatedClients = React.useMemo(() => {
    if (isBasicView && pagedData?.clients) return filteredAndSortedClients;
    return filteredAndSortedClients.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [isBasicView, pagedData, filteredAndSortedClients, currentPage, ITEMS_PER_PAGE]);

  const handleCreateClient = React.useCallback((clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    createClient(clientData);
    setIsDialogOpen(false);
    toast.success("Cliente creado", { description: "El cliente ha sido creado exitosamente." });
  }, [createClient]);

  const handleUpdateClient = React.useCallback((clientData: any) => {
    if (selectedClient) {
      if (clientData._isAddingDepartment) {
        const newClientData = {
          name: clientData.name, rut: clientData.rut, phone: clientData.phone, email: clientData.email,
          address: clientData.address, contactName: clientData.contactName, isActive: clientData.isActive,
          department: clientData.department, departments: [clientData.department]
        };
        createClient(newClientData);
        setIsDialogOpen(false);
        setSelectedClient(undefined);
        toast.success("Departamento agregado", { description: `Se agregó el departamento "${clientData.department}" al cliente.` });
      } else {
        updateClient(selectedClient.id, clientData);
        setIsDialogOpen(false);
        setSelectedClient(undefined);
        toast.success("Cliente actualizado", { description: "Los datos del cliente han sido actualizados." });
      }
    }
  }, [selectedClient, updateClient, createClient]);

  const handleEditClient = React.useCallback((client: Client) => { setSelectedClient(client); setIsDialogOpen(true); }, []);
  const handleDeleteClient = React.useCallback((client: Client) => {
    if (window.confirm(`¿Estás seguro de eliminar al cliente "${client.name}"?`)) {
      deleteClient(client.id);
      toast.error("Cliente eliminado", { description: "El cliente ha sido eliminado del sistema." });
    }
  }, [deleteClient]);
  const handleToggleStatus = React.useCallback((client: Client) => {
    toggleClientStatus(client.id);
    toast.info(client.isActive ? "Cliente desactivado" : "Cliente activado", { description: `El cliente ha sido ${client.isActive ? 'desactivado' : 'activado'}.` });
  }, [toggleClientStatus]);
  const handleNewClient = React.useCallback(() => { setSelectedClient(undefined); setIsDialogOpen(true); }, []);
  const handleViewDetails = React.useCallback((client: Client) => { setSelectedClientForDetails(client); setIsDetailsModalOpen(true); }, []);
  const handleCloseDetailsModal = React.useCallback(() => { setIsDetailsModalOpen(false); setSelectedClientForDetails(null); }, []);

  if (loading || (isBasicView && pagedLoading && !pagedData)) {
    return <div className="flex items-center justify-center h-64"><div className="text-foreground">Cargando clientes...</div></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <ClientsHeader
        isDialogOpen={isDialogOpen} setIsDialogOpen={setIsDialogOpen}
        selectedClient={selectedClient} setSelectedClient={setSelectedClient}
        handleNewClient={handleNewClient} handleCreateClient={handleCreateClient} handleUpdateClient={handleUpdateClient}
      />

      <ClientsDashboard {...metrics} />

      <ClientsFilters
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        departments={departments} selectedDepartment={selectedDepartment} setSelectedDepartment={setSelectedDepartment}
        activeCount={metrics.activeClients} inactiveCount={metrics.inactiveClients} totalCount={clients.length}
      />

      <ClientsTable
        clients={paginatedClients} totalClients={filteredAndSortedClients.length}
        onEdit={handleEditClient} onDelete={handleDeleteClient} onToggleStatus={handleToggleStatus}
        onViewDetails={handleViewDetails} onNewClient={handleNewClient} searchTerm={searchTerm}
        sortField={sortField} sortDirection={sortDirection} onSort={handleSort}
        serviceCountByClient={serviceCountByClient}
      />
      
      <AppPagination className="py-4" currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      
      {selectedClientForDetails && (
        <ClientDetailsModal client={selectedClientForDetails} isOpen={isDetailsModalOpen} onClose={handleCloseDetailsModal} />
      )}
    </div>
  );
};

export default Clients;
