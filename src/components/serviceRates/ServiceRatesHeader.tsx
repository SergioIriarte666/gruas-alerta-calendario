import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, RefreshCw, DollarSign } from 'lucide-react';

interface ServiceRatesHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onAddNew: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const ServiceRatesHeader: React.FC<ServiceRatesHeaderProps> = ({
  searchTerm,
  onSearchChange,
  onAddNew,
  onRefresh,
  isLoading,
}) => {
  return (
    <div className="configuration-filter-panel space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="dashboard-section-kicker"><DollarSign className="size-3.5" />Matriz comercial</span>
          <div>
            <h1 className="dashboard-section-title">Tarifas de Servicio</h1>
            <p className="dashboard-section-description">Precios predefinidos por cliente, servicio y ruta.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={onAddNew} className="dashboard-report-button">
            <Plus className="size-4 mr-2" />
            Nueva Tarifa
          </Button>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente, origen o destino..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
    </div>
  );
};
