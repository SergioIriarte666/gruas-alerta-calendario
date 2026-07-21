import React from 'react';
import { Search, FileText, Users, Receipt, User, Truck, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useGlobalSearch, GlobalSearchResult } from '@/hooks/useGlobalSearch';

const getIconForType = (type: GlobalSearchResult['type']) => {
  const iconMap = {
    service: FileText,
    client: Users,
    invoice: Receipt,
    operator: User,
    crane: Truck
  };
  const Icon = iconMap[type];
  return <Icon className="size-4" />;
};

const getTypeLabel = (type: GlobalSearchResult['type']) => {
  const labelMap = {
    service: 'Servicio',
    client: 'Cliente',
    invoice: 'Factura',
    operator: 'Operador',
    crane: 'Grúa'
  };
  return labelMap[type];
};

export const GlobalSearch = () => {
  const {
    searchTerm,
    results,
    isLoading,
    isOpen,
    handleInputChange,
    handleInputFocus,
    handleInputBlur,
    handleResultClick,
    clearSearch: _clearSearch
  } = useGlobalSearch();

  return (
    <div className="relative max-w-md flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar servicios, clientes, facturas..."
          className="border-border bg-background pl-10 pr-4 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
          value={searchTerm}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          {results.length === 0 && !isLoading && searchTerm.trim().length >= 2 && (
            <div className="p-4 text-center text-muted-foreground">
              No se encontraron resultados
            </div>
          )}
          
          {results.length > 0 && (
            <div className="py-2">
              {results.map((result) => (
                <div
                  key={`${result.type}-${result.id}`}
                  className="cursor-pointer border-b border-border/60 px-4 py-2 last:border-b-0 hover:bg-accent/60"
                  onClick={() => handleResultClick(result)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 text-muted-foreground">
                      {getIconForType(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-foreground">
                          {result.title}
                        </span>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {getTypeLabel(result.type)}
                        </span>
                      </div>
                      {result.subtitle && (
                        <p className="truncate text-sm text-muted-foreground">
                          {result.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {searchTerm.trim().length < 2 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Escribe al menos 2 caracteres para buscar
            </div>
          )}
        </div>
      )}
    </div>
  );
};
