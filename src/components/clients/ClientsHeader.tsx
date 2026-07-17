import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ContactRound, Plus } from 'lucide-react';
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="dashboard-section-kicker">
            <ContactRound className="size-3.5" />
            Cartera comercial
          </span>
          <h1 className="dashboard-section-title">Clientes</h1>
          <p className="dashboard-section-description">Cartera, departamentos y actividad comercial en una sola vista.</p>
        </div>
        <Button onClick={handleNewClient} size="sm" className="dashboard-report-button">
          <Plus className="mr-2 size-4" />
          Nuevo cliente
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open ? handleCloseModal() : setIsDialogOpen(true)}>
        <DialogContent className="operations-dialog max-h-[90vh] max-w-4xl border-border/70 bg-popover/95 p-0">
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
