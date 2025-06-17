
import React from 'react';
import { ServiceClosure } from '@/types';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClosuresForInvoices } from '@/hooks/useClosuresForInvoices';
import { useClients } from '@/hooks/useClients';

interface ClosureSelectorProps {
  selectedClosureId: string;
  onClosureChange: (closureId: string) => void;
}

const ClosureSelector: React.FC<ClosureSelectorProps> = ({
  selectedClosureId,
  onClosureChange
}) => {
  const { closures, loading } = useClosuresForInvoices();
  const { clients } = useClients();

  const getClientName = (clientId?: string) => {
    if (!clientId) return 'Todos los clientes';
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Cliente desconocido';
  };

  const formatDateRange = (dateRange: { from: string; to: string }) => {
    const fromDate = new Date(dateRange.from).toLocaleDateString('es-CL');
    const toDate = new Date(dateRange.to).toLocaleDateString('es-CL');
    return `${fromDate} - ${toDate}`;
  };

  if (loading) {
    return (
      <div>
        <Label className="text-gray-300">Cierre</Label>
        <div className="mt-1 bg-white/5 border border-gray-700 rounded px-3 py-2 text-white">
          Cargando cierres...
        </div>
      </div>
    );
  }

  return (
    <div>
      <Label htmlFor="closureId" className="text-gray-300">Cierre</Label>
      <Select value={selectedClosureId} onValueChange={onClosureChange}>
        <SelectTrigger className="bg-white/5 border-gray-700 text-white">
          <SelectValue placeholder="Seleccionar cierre" />
        </SelectTrigger>
        <SelectContent>
          {closures.map((closure) => (
            <SelectItem key={closure.id} value={closure.id}>
              <div className="flex flex-col">
                <span className="font-medium">{closure.folio}</span>
                <span className="text-sm text-gray-500">
                  {formatDateRange(closure.dateRange)} - {getClientName(closure.clientId)}
                </span>
                <span className="text-sm font-medium">
                  ${Math.round(closure.total).toLocaleString()}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {closures.length === 0 && (
        <p className="text-sm text-gray-400 mt-1">
          No hay cierres disponibles para facturar
        </p>
      )}
    </div>
  );
};

export default ClosureSelector;
