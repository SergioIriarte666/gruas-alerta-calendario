import React, { useState } from 'react';
import { ServiceClosure } from '@/types';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useClosuresForInvoices } from '@/hooks/useClosuresForInvoices';
import { useClients } from '@/hooks/useClients';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { Check, ChevronDown, FileText, Calendar, User, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnhancedClosureSelectorProps {
  selectedClosureId: string;
  onClosureChange: (closureId: string) => void;
  isEditing?: boolean;
  currentInvoice?: { id: string; closureId: string };
  disabled?: boolean;
}

const EnhancedClosureSelector: React.FC<EnhancedClosureSelectorProps> = ({
  selectedClosureId,
  onClosureChange,
  isEditing = false,
  currentInvoice,
  disabled = false
}) => {
  const [open, setOpen] = useState(false);
  const { closures, loading } = useClosuresForInvoices({ 
    includeInvoiced: isEditing
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

  const selectedClosure = closures.find(c => c.id === selectedClosureId);

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
    <div className="space-y-2">
      <Label className="text-foreground">
        Cierre
        {isEditing && (
          <span className="text-xs text-primary ml-2">
            (Modo edición - incluye cierres facturados)
          </span>
        )}
      </Label>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between bg-background border-input text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed min-h-[60px] p-3"
          >
            {selectedClosure ? (
              <div className="flex flex-col items-start text-left w-full">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <FileText className="w-4 h-4" />
                  {selectedClosure.folio}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDateRange(selectedClosure.dateRange)} • {getClientName(selectedClosure.clientId)} • ${Math.round(selectedClosure.total).toLocaleString()}
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground">Seleccionar cierre...</span>
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-[600px] p-0 bg-card border" align="start">
          <Command className="bg-card">
            <CommandInput 
              placeholder="Buscar por folio, cliente o fecha..." 
              className="text-foreground placeholder:text-muted-foreground"
            />
            <CommandList className="max-h-[400px]">
              <CommandEmpty className="text-muted-foreground text-center py-6">
                No se encontraron cierres.
              </CommandEmpty>
              <CommandGroup>
                {closures.map((closure) => (
                  <CommandItem
                    key={closure.id}
                    value={`${closure.folio} ${getClientName(closure.clientId)} ${formatDateRange(closure.dateRange)}`}
                    onSelect={() => {
                      onClosureChange(closure.id);
                      setOpen(false);
                    }}
                    className="p-0 cursor-pointer"
                  >
                  <div className="flex items-start justify-between w-full p-4 hover:bg-muted rounded-md">
                    <div className="flex-1 space-y-2">
                      {/* Folio */}
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="font-medium text-primary">{closure.folio}</span>
                        {selectedClosureId === closure.id && (
                          <Check className="w-4 h-4 text-primary ml-auto" />
                        )}
                      </div>
                        
                      {/* Fechas */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>{formatDateRange(closure.dateRange)}</span>
                      </div>
                      
                      {/* Cliente */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="truncate">{getClientName(closure.clientId)}</span>
                      </div>
                      
                      {/* Monto */}
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-primary">
                          ${Math.round(closure.total).toLocaleString()}
                        </span>
                      </div>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
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

export default EnhancedClosureSelector;