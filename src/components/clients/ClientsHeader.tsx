import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
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
  const handleCloseModal = React.useCallback(() => {
    setIsDialogOpen(false);
    setSelectedClient(undefined);
  }, [setIsDialogOpen, setSelectedClient]);

  return (
    <>
      <PageHeader
        title="Gestión de Clientes"
        description="Administra cartera, departamentos y actividad comercial desde una sola vista."
        actions={
          <Button onClick={handleNewClient}>
            <Plus className="mr-2 size-4" />
            Nuevo Cliente
          </Button>
        }
      />

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open ? handleCloseModal() : setIsDialogOpen(true)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-border/70 bg-popover/95 p-0">
            <ClientForm
              client={selectedClient}
              onSubmit={selectedClient ? handleUpdateClient : handleCreateClient}
              onCancel={handleCloseModal}
            />
        </DialogContent>
      </Dialog>
    </>
  );
};
