
import * as React from 'react';
import { X } from 'lucide-react';
import { Client } from '@/types';
import { Button } from '@/components/ui/button';
import { ClientTabsWithCounters } from './ClientTabsWithCounters';

interface ClientDetailsModalProps {
  client: Client;
  isOpen: boolean;
  onClose: () => void;
}

export const ClientDetailsModal = ({ client, isOpen, onClose }: ClientDetailsModalProps) => {
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div 
        className="relative bg-black border border-tms-green rounded-lg shadow-lg max-w-7xl w-full mx-4 h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white z-20 p-1 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Cerrar modal"
        >
          <X className="h-4 w-4" />
        </button>
        
        {/* Header del Cliente - Fijo */}
        <div className="flex-shrink-0 p-6 border-b border-tms-green/30">
          <h2 className="text-2xl font-bold text-white mb-2">{client.name}</h2>
          <div className="flex flex-wrap gap-4 text-sm text-gray-300">
            <span>RUT: {client.rut}</span>
            <span>•</span>
            <span>Departamento: {client.department}</span>
            <span>•</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              client.isActive 
                ? 'bg-tms-green/20 text-tms-green' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              {client.isActive ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
        
        {/* Contenido con Scroll */}
        <div className="flex-1 min-h-0">
          <ClientTabsWithCounters client={client} />
        </div>
        
        {/* Footer - Fijo */}
        <div className="flex-shrink-0 flex justify-end p-6 border-t border-tms-green/30">
          <Button 
            onClick={onClose}
            variant="outline"
            className="border-tms-green/50 text-white hover:bg-tms-green hover:text-black"
          >
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
};
