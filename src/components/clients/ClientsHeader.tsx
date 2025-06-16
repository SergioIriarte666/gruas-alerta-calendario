
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { ClientForm } from '@/components/clients/ClientForm';
import { Client } from '@/types';

interface ClientsHeaderProps {
  isDialogOpen: boolean;
  setIsDialogOpen: (isOpen: boolean) => void;
  selectedClient: Client | undefined;
  setSelectedClient: (client: Client | undefined) => void;
  handleNewClient: () => void;
  handleCreateClient: (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => void;
  handleUpdateClient: (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export const ClientsHeader = ({
  isDialogOpen,
  setIsDialogOpen,
  selectedClient,
  setSelectedClient,
  handleNewClient,
  handleCreateClient,
  handleUpdateClient,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Gestión de Clientes</h1>
          <p className="text-gray-400 mt-2">
            Administra la información de todos los clientes del sistema
          </p>
        </div>
        
        <Button 
          onClick={handleNewClient}
          className="bg-tms-green hover:bg-tms-green-dark text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Custom Modal Implementation */}
      {isDialogOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80"
          onClick={handleCloseModal}
        >
          <div 
            className="relative bg-tms-dark border border-gray-700 rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseModal}
              className="absolute right-4 top-4 text-gray-400 hover:text-white z-10 p-1 rounded-full hover:bg-gray-700 transition-colors"
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
