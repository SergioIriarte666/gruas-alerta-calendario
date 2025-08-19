
import React from 'react';
import { ServiceClosure } from '@/types';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClosuresForInvoices } from '@/hooks/useClosuresForInvoices';
import { useClients } from '@/hooks/useClients';
import { formatForDisplay } from '@/utils/timezoneUtils';
import './ClosureSelector.css';

interface ClosureSelectorProps {
  selectedClosureId: string;
  onClosureChange: (closureId: string) => void;
  isEditing?: boolean;
  currentInvoice?: { id: string; closureId: string }; // Add current invoice info
  disabled?: boolean; // Add disabled prop
}

const ClosureSelector: React.FC<ClosureSelectorProps> = ({
  selectedClosureId,
  onClosureChange,
  isEditing = false,
  currentInvoice,
  disabled = false
}) => {
  const { closures, loading } = useClosuresForInvoices({ 
    includeInvoiced: isEditing // Include already invoiced closures when editing
  });
  const { clients } = useClients();

  const getClientName = (clientId?: string) => {
    if (!clientId) return 'Todos los clientes';
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Cliente desconocido';
  };

  const formatDateRange = (dateRange: { from: string; to: string }) => {
    const fromDate = formatForDisplay(dateRange.from);
    const toDate = formatForDisplay(dateRange.to);
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
    <div className="ClosureSelector-container">
      <Label htmlFor="closureId" className="text-gray-300">
        Cierre
        {isEditing && (
          <span className="text-xs text-orange-400 ml-2">
            (Modo edición - incluye cierres facturados)
          </span>
        )}
      </Label>
      <Select value={selectedClosureId} onValueChange={onClosureChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Seleccionar cierre" />
        </SelectTrigger>
        <SelectContent>
          {closures.map((closure) => (
            <SelectItem key={closure.id} value={closure.id}>
              <div className="ClosureSelector-item-content">
                <div className="ClosureSelector-folio">{closure.folio}</div>
                <div className="ClosureSelector-date">
                  {formatDateRange(closure.dateRange)}
                </div>
                <div className="ClosureSelector-client">
                  {getClientName(closure.clientId)}
                </div>
                <div className="ClosureSelector-amount">
                  ${Math.round(closure.total).toLocaleString()}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {disabled && (
        <p className="text-xs text-orange-400 mt-1">
          No se puede cambiar el cierre para facturas ya emitidas
        </p>
      )}
      
      {closures.length === 0 && (
        <p className="text-sm text-gray-400 mt-1">
          {isEditing 
            ? "No hay cierres disponibles (verifica que existan cierres cerrados o facturados)"
            : "No hay cierres disponibles para facturar"
          }
        </p>
      )}
      
      {/* Debug info in edit mode */}
      {isEditing && process.env.NODE_ENV === 'development' && (
        <p className="text-xs text-blue-400 mt-1">
          Debug: Modo edición activo, mostrando cierres con estado 'closed' e 'invoiced'
        </p>
      )}
    </div>
  );
};

export default ClosureSelector;
