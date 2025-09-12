
import * as React from 'react';
import { Client } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClientTabsWithCounters } from './ClientTabsWithCounters';

interface ClientDetailsModalProps {
  client: Client;
  isOpen: boolean;
  onClose: () => void;
}

export const ClientDetailsModal = ({ client, isOpen, onClose }: ClientDetailsModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground mb-2">{client.name}</DialogTitle>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>RUT: {client.rut}</span>
            <span>•</span>
            <span>Departamento: {client.department}</span>
            <span>•</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              client.isActive 
                ? 'bg-primary/10 text-primary' 
                : 'bg-destructive/10 text-destructive'
            }`}>
              {client.isActive ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </DialogHeader>
        
        {/* Contenido con Scroll */}
        <div className="flex-1 min-h-0 client-scope">
          <ClientTabsWithCounters client={client} />
        </div>
        
        {/* Footer */}
        <div className="flex justify-end pt-4 mt-4 border-t">
          <Button 
            onClick={onClose}
            variant="outline"
          >
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
