
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
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
  return (
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
  );
};
