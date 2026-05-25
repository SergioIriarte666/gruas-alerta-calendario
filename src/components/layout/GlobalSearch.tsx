import React from 'react';
import { Search, FileText, Users, Receipt, User, Truck, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useGlobalSearch, GlobalSearchResult } from '@/hooks/useGlobalSearch';
import { cn } from '@/lib/utils';

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
    clearSearch
  } = useGlobalSearch();

  return (
    <div className="relative max-w-md flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-4" />
        <Input
          placeholder="Buscar servicios, clientes, facturas..."
          className="pl-10 pr-4 bg-white border-gray-300 text-black placeholder-gray-500 focus:border-tms-green focus:ring-tms-green"
          value={searchTerm}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-4 animate-spin" />
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {results.length === 0 && !isLoading && searchTerm.trim().length >= 2 && (
            <div className="p-4 text-center text-gray-500">
              No se encontraron resultados
            </div>
          )}
          
          {results.length > 0 && (
            <div className="py-2">
              {results.map((result) => (
                <div
                  key={`${result.type}-${result.id}`}
                  className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 border-gray-100"
                  onClick={() => handleResultClick(result)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 text-gray-400">
                      {getIconForType(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {result.title}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-tms-green/20 text-tms-green rounded-full font-medium">
                          {getTypeLabel(result.type)}
                        </span>
                      </div>
                      {result.subtitle && (
                        <p className="text-sm text-gray-500 truncate">
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
            <div className="p-4 text-center text-gray-500 text-sm">
              Escribe al menos 2 caracteres para buscar
            </div>
          )}
        </div>
      )}
    </div>
  );
};