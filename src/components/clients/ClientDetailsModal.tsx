
import * as React from 'react';
import { X } from 'lucide-react';
import { Client } from '@/types';
import { Button } from '@/components/ui/button';

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
        className="relative bg-black border border-tms-green rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white z-10 p-1 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Cerrar modal"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-6">Detalles del Cliente</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nombre/Razón Social
                </label>
                <p className="text-white bg-white/5 border border-tms-green/30 rounded px-3 py-2">
                  {client.name}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  RUT
                </label>
                <p className="text-white bg-white/5 border border-tms-green/30 rounded px-3 py-2">
                  {client.rut}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email
                </label>
                <p className="text-white bg-white/5 border border-tms-green/30 rounded px-3 py-2">
                  {client.email || 'No especificado'}
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Teléfono
                </label>
                <p className="text-white bg-white/5 border border-tms-green/30 rounded px-3 py-2">
                  {client.phone || 'No especificado'}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Dirección
                </label>
                <p className="text-white bg-white/5 border border-tms-green/30 rounded px-3 py-2">
                  {client.address || 'No especificada'}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Estado
                </label>
                <p className={`inline-flex px-2 py-1 rounded text-sm font-medium ${
                  client.isActive 
                    ? 'bg-tms-green/20 text-tms-green border border-tms-green/30' 
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {client.isActive ? 'Activo' : 'Inactivo'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end mt-6">
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
    </div>
  );
};
