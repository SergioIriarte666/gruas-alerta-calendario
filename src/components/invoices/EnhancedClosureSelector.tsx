import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useClosuresForInvoices, ClosureWithClient } from '@/hooks/useClosuresForInvoices';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { Check, ChevronDown, FileText, Calendar, User, DollarSign, ShoppingCart } from 'lucide-react';
import { toTitleCase } from '@/lib/utils';

const isDev = import.meta.env.DEV;

interface EnhancedClosureSelectorProps {
  selectedClosureId: string;
  onClosureChange: (closureId: string) => void;
  isEditing?: boolean;
  currentInvoice?: {
    id: string;
    closureId: string;
  };
  disabled?: boolean;
  closures?: ClosureWithClient[];
  loading?: boolean;
}

const EnhancedClosureSelector: React.FC<EnhancedClosureSelectorProps> = ({
  selectedClosureId,
  onClosureChange,
  isEditing = false,
  currentInvoice: _currentInvoice,
  disabled = false,
  closures: propClosures,
  loading: propLoading
}) => {
  const [open, setOpen] = useState(false);
  
  // Use hook only if closures are not provided via props
  const hookResult = useClosuresForInvoices({
    includeInvoiced: isEditing,
    enabled: !propClosures
  });

  const closures = propClosures ?? hookResult.closures;
  const loading = propLoading ?? hookResult.loading;

  const [search, setSearch] = useState("");

  const getClientName = (closure: any) => {
    return closure.clientName ? toTitleCase(closure.clientName) : 'Todos los clientes';
  };

  const formatDateRange = (dateRange: {
    from: string;
    to: string;
  }) => {
    const fromDate = formatForDisplay(dateRange.from);
    const toDate = formatForDisplay(dateRange.to);
    return `${fromDate} - ${toDate}`;
  };
  
  const processedClosures = React.useMemo(() => {
    if (!closures) return [];
    return closures.map(c => {
      const clientName = getClientName(c);
      const dateRangeStr = formatDateRange(c.dateRange);
      return {
        ...c,
        displayClientName: clientName,
        displayDateRange: dateRangeStr,
        searchString: `${c.folio} ${clientName} ${dateRangeStr} ${c.purchaseOrder || ''}`.toLowerCase()
      };
    });
  }, [closures]);
  
  const filteredClosures = React.useMemo(() => {
    if (!processedClosures.length) return [];
    
    let result = processedClosures;
    
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = processedClosures.filter(closure => closure.searchString.includes(lowerSearch));
    }
    
    return result.slice(0, 50);
  }, [processedClosures, search]);

  const selectedClosure = closures.find(c => c.id === selectedClosureId);
  if (loading) {
    return <div>
        <Label className="text-foreground">Cierre</Label>
        <div className="mt-1 rounded border border-border/70 bg-muted/30 px-3 py-2 text-foreground">
          Cargando cierres...
        </div>
      </div>;
  }
  return <div className="space-y-2">
      <Label className="text-foreground">
        Cierre
        {isEditing && <span className="ml-2 text-xs text-primary">(Modo edición - incluye cierres facturados)</span>}
      </Label>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="w-full justify-between bg-background border-input text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed min-h-[60px] p-3">
            {selectedClosure ? <div className="flex flex-col items-start text-left w-full">
                <div className="flex items-center gap-2 font-medium text-primary">
                  <FileText className="size-4" />
                  {selectedClosure.folio}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDateRange(selectedClosure.dateRange)} • {getClientName(selectedClosure)} • {selectedClosure.purchaseOrder ? `OC: ${selectedClosure.purchaseOrder}` : 'Sin OC'} • ${Math.round(selectedClosure.total).toLocaleString()}
                </div>
              </div> : <span className="text-muted-foreground">Seleccionar cierre...</span>}
            <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-[600px] border-border/70 bg-card p-0" align="start">
          <Command className="bg-card" shouldFilter={false}>
            <CommandInput 
              placeholder="Buscar por folio, cliente o fecha..." 
              className="text-foreground placeholder:text-muted-foreground" 
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-[400px]">
              <CommandEmpty className="text-muted-foreground text-center py-6">
                No se encontraron cierres.
              </CommandEmpty>
              <CommandGroup>
                {filteredClosures.map(closure => <CommandItem key={closure.id} value={`${closure.folio} ${closure.displayClientName} ${closure.displayDateRange} ${closure.purchaseOrder || ''}`} onSelect={() => {
                onClosureChange(closure.id);
                setOpen(false);
              }} className="p-0 cursor-pointer">
                  <div className="flex items-start justify-between w-full p-4 hover:bg-muted rounded-md">
                    <div className="flex-1 gap-y-2">
                      {/* Folio */}
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-foreground" />
                        <span className="font-medium text-foreground">{closure.folio}</span>
                        {selectedClosureId === closure.id && <Check className="size-4 text-primary ml-auto" />}
                      </div>
                        
                      {/* Fechas */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="size-4 text-muted-foreground" />
                        <span>{closure.displayDateRange}</span>
                      </div>
                      
                      {/* Cliente */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="size-4 text-muted-foreground" />
                        <span className="truncate">{closure.displayClientName}</span>
                      </div>
                      
                      {/* Orden de Compra */}
                      <div className="flex items-center gap-2 text-sm">
                        <ShoppingCart className="size-4 text-muted-foreground" />
                        <span className={closure.purchaseOrder ? "text-foreground" : "text-muted-foreground"}>
                          {closure.purchaseOrder ? `OC: ${closure.purchaseOrder}` : 'Sin OC'}
                        </span>
                      </div>
                      
                      {/* Monto */}
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="size-4 text-primary" />
                        <span className="font-medium text-primary">
                          ${Math.round(closure.total).toLocaleString()}
                        </span>
                      </div>
                      </div>
                    </div>
                  </CommandItem>)}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {disabled && <p className="mt-1 text-xs text-warning">
          No se puede cambiar el cierre para facturas ya emitidas
        </p>}
      
      {closures.length === 0 && <p className="mt-1 text-sm text-muted-foreground">
          {isEditing ? "No hay cierres disponibles (verifica que existan cierres cerrados o facturados)" : "No hay cierres disponibles para facturar"}
        </p>}
      
      {/* Debug info in edit mode */}
      {isEditing && isDev && <p className="text-xs text-primary mt-1">
          Debug: Modo edición activo, mostrando cierres con estado 'closed' e 'invoiced'
        </p>}
    </div>;
};
export default EnhancedClosureSelector;
