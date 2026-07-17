import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toTitleCase } from '@/lib/utils';
import { Client } from '@/types';

interface ClientDetailModalProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  client,
  open,
  onOpenChange,
}) => {
  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="operations-dialog max-w-4xl max-h-[90vh] bg-card">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Detalles del Cliente: {toTitleCase(client.name)}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="bg-muted/50 rounded-md p-1">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">RUT</label>
                  <p className="text-foreground">{client.rut}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Departamento</label>
                  <p className="text-foreground">{client.department}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Teléfono</label>
                  <p className="text-foreground">{client.phone}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-foreground">{client.email}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Dirección</label>
                <p className="text-foreground">{client.address ? toTitleCase(client.address) : ''}</p>
              </div>

              {client.contactName && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Contacto</label>
                  <p className="text-foreground">{toTitleCase(client.contactName)}</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="text-center py-8 text-muted-foreground">
              Historial de servicios y facturas - Próximamente
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
