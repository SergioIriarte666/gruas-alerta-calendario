
import * as React from 'react';
import { Client } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClientTabsWithCounters } from './ClientTabsWithCounters';
import { formatForDisplayWithTime } from '@/utils/timezoneUtils';
import { toTitleCase } from '@/lib/utils';

interface ClientDetailsModalProps {
  client: Client;
  isOpen: boolean;
  onClose: () => void;
}

export const ClientDetailsModal = ({ client, isOpen, onClose }: ClientDetailsModalProps) => {
  const [logoUrl, setLogoUrl] = React.useState<string | null>(client.logoUrl || null);

  React.useEffect(() => {
    setLogoUrl(client.logoUrl || null);
  }, [client.id, client.logoUrl]);

  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl w-[95vw] max-h-[90vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-4">
            {logoUrl ? (
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30 p-1.5">
                <img src={logoUrl} alt={`Logo ${client.name}`} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                <span className="text-lg font-bold text-primary">{getInitials(client.name)}</span>
              </div>
            )}
            <div>
              <DialogTitle className="text-2xl font-bold text-foreground">{toTitleCase(client.name)}</DialogTitle>
              <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>RUT: {client.rut}</span>
                <span>•</span>
                <span>Departamento: {client.department}</span>
                <span>•</span>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                  client.isActive
                    ? 'bg-primary/10 text-primary'
                    : 'bg-destructive/10 text-destructive'
                }`}>
                  {client.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>
        
        {/* Contenido con Scroll */}
        <div className="flex-1 min-h-0">
          <ClientTabsWithCounters client={client} logoUrl={logoUrl} onLogoChange={setLogoUrl} />
        </div>
        
        {/* Footer con información de creación */}
        <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-xs sm:text-sm text-muted-foreground pt-4 mt-4 border-t">
          <span className="truncate">
            Creado: {formatForDisplayWithTime(client.createdAt)}
            {client.creatorName && ` por ${client.creatorName}`}
          </span>
          <span className="truncate">Actualizado: {formatForDisplayWithTime(client.updatedAt)}</span>
        </div>
        
        {/* Footer con botón */}
        <div className="flex justify-end pt-2">
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
