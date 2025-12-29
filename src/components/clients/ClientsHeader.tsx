import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, X, Eye, EyeOff } from 'lucide-react';
import { ClientForm } from '@/components/clients/ClientForm';
import { Client } from '@/types';
import { ClientsMetricsCards } from './ClientsMetricsCards';
import { ClientsQuickFilters, ClientStatusFilter } from './ClientsQuickFilters';

interface ClientsHeaderProps {
  isDialogOpen: boolean;
  setIsDialogOpen: (isOpen: boolean) => void;
  selectedClient: Client | undefined;
  setSelectedClient: (client: Client | undefined) => void;
  handleNewClient: () => void;
  handleCreateClient: (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => void;
  handleUpdateClient: (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => void;
  // Nuevas props para métricas
  totalClients: number;
  activeClients: number;
  uniqueCompanies: number;
  multiDepartmentCompanies: number;
  activePercentage: number;
  // Props para filtros
  statusFilter: ClientStatusFilter;
  onStatusFilterChange: (filter: ClientStatusFilter) => void;
}

export const ClientsHeader = ({
  isDialogOpen,
  setIsDialogOpen,
  selectedClient,
  setSelectedClient,
  handleNewClient,
  handleCreateClient,
  handleUpdateClient,
  totalClients,
  activeClients,
  uniqueCompanies,
  multiDepartmentCompanies,
  activePercentage,
  statusFilter,
  onStatusFilterChange,
}: ClientsHeaderProps) => {
  const handleCloseModal = () => {
    setIsDialogOpen(false);
    setSelectedClient(undefined);
  };

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isDialogOpen) {
        handleCloseModal();
      }
    };

    if (isDialogOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isDialogOpen]);

  return (
    <>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between bg-white p-6 rounded-lg border">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestión de Clientes</h1>
            <p className="text-muted-foreground mt-2">
              Administra la información de todos los clientes del sistema
            </p>
          </div>
          
          <Button 
            size="lg"
            onClick={handleNewClient}
            className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-lg px-8 py-6 shadow-lg"
          >
            <Plus className="w-6 h-6 mr-3" />
            Nuevo Cliente
          </Button>
        </div>

        {/* Quick Filters */}
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Filtros Rápidos</h3>
              <ClientsQuickFilters
                selected={statusFilter}
                onChange={onStatusFilterChange}
                multiDepartmentCount={multiDepartmentCompanies}
              />
            </div>
          </div>
        </div>

        {/* Metrics Section */}
        <div className="bg-white p-6 rounded-lg border space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Resumen de Clientes</h2>
          <ClientsMetricsCards
            totalClients={totalClients}
            activeClients={activeClients}
            uniqueCompanies={uniqueCompanies}
            multiDepartmentCompanies={multiDepartmentCompanies}
            activePercentage={activePercentage}
          />
        </div>
      </div>

      {/* Custom Modal Implementation */}
      {isDialogOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={handleCloseModal}
        >
          <div 
            className="relative bg-white border border-gray-200 rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseModal}
              className="absolute right-4 top-4 text-gray-600 hover:text-black z-10 p-1 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Cerrar modal"
            >
              <X className="h-4 w-4" />
            </button>
            
            <ClientForm
              client={selectedClient}
              onSubmit={selectedClient ? handleUpdateClient : handleCreateClient}
              onCancel={handleCloseModal}
            />
          </div>
        </div>
      )}
    </>
  );
};
