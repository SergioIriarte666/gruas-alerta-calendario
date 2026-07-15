
import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClosuresForInvoices } from '@/hooks/useClosuresForInvoices';
import { useClients } from '@/hooks/useClients';
import { formatForDisplay } from '@/utils/timezoneUtils';
import './ClosureSelector.css';

const isDev = import.meta.env.DEV;

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
  currentInvoice: _currentInvoice,
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
        <Label className="text-foreground">Cierre</Label>
        <div className="mt-1 rounded border border-border/70 bg-muted/30 px-3 py-2 text-foreground">
          Cargando cierres...
        </div>
      </div>
    );
  }

  return (
    <div className="ClosureSelector-container">
      <Label htmlFor="closureId" className="text-foreground">
        Cierre
        {isEditing && (
          <span className="ml-2 text-xs text-warning">
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
        <p className="mt-1 text-xs text-warning">
          No se puede cambiar el cierre para facturas ya emitidas
        </p>
      )}
      
      {closures.length === 0 && (
        <p className="mt-1 text-sm text-muted-foreground">
          {isEditing 
            ? "No hay cierres disponibles (verifica que existan cierres cerrados o facturados)"
            : "No hay cierres disponibles para facturar"
          }
        </p>
      )}
      
      {/* Debug info in edit mode */}
      {isEditing && isDev && (
        <p className="mt-1 text-xs text-primary">
          Debug: Modo edición activo, mostrando cierres con estado 'closed' e 'invoiced'
        </p>
      )}
    </div>
  );
};

export default ClosureSelector;
