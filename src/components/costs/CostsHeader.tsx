
import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Search, Download, Grid3X3, Table, Code, TrendingUp, TrendingDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { CostFiltersComponent, CostFilters } from './CostFilters';
import { QuickDateFilters } from './QuickDateFilters';

interface CostsHeaderProps {
  onAddCost: () => void;
  onXMLUpload: () => void;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  onExport?: () => void;
  totalCosts?: number;
  totalAmount?: number;
  viewMode?: 'table' | 'cards';
  onViewModeChange?: (mode: 'table' | 'cards') => void;
  filters?: CostFilters;
  onFiltersChange?: (filters: CostFilters) => void;
  onClearFilters?: () => void;
  // Nuevas props para filtros de fecha
  dateFilter?: string;
  onDateFilterChange?: (filter: string) => void;
  todayCount?: number;
  currentMonthTotal?: number;
  monthVariation?: number;
}

export const CostsHeader = ({ 
  onAddCost,
  onXMLUpload,
  searchTerm = '', 
  onSearchChange, 
  onExport,
  totalCosts = 0,
  totalAmount = 0,
  viewMode = 'table',
  onViewModeChange,
  filters,
  onFiltersChange,
  onClearFilters,
  dateFilter = 'today',
  onDateFilterChange,
  todayCount = 0,
  currentMonthTotal = 0,
  monthVariation = 0
}: CostsHeaderProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getActivePeriodLabel = () => {
    switch (dateFilter) {
      case 'today': return 'Hoy';
      case 'week': return 'Esta Semana';
      case 'month': return 'Este Mes';
      default: return 'Todos los Períodos';
    }
  };

  return (
    <div className="space-y-4">
      {/* Título y botón principal */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground ">
            Gestión de Costos
          </h1>
          <p className="text-muted-foreground  mt-1">
            Administra y registra todos los costos operativos de la empresa
            {dateFilter !== 'all' && (
              <span className="ml-2 rounded-full bg-success-soft px-2 py-1 text-xs font-medium text-success-text">
                Mostrando: {getActivePeriodLabel()}
              </span>
            )}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={onAddCost}
            className="bg-success text-success-foreground hover:bg-success/90 hover-scale"
          >
            <Plus className="size-4 mr-2" />
            Nuevo Costo
          </Button>
          
          <Button 
            onClick={onXMLUpload}
            variant="outline"
            className="border-info/30 text-info-text hover:bg-info hover:text-info-foreground"
          >
            <Code className="size-4 mr-2" />
            Cargar XML
          </Button>
        </div>
      </div>

      {/* Filtros rápidos de fecha */}
      {onDateFilterChange && (
        <div className="bg-card p-4 rounded-lg shadow-sm border">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-foreground  mb-2">
                Filtros Rápidos
              </h3>
              <QuickDateFilters
                activeFilter={dateFilter}
                onFilterChange={onDateFilterChange}
                todayCount={todayCount}
              />
            </div>
          </div>
        </div>
      )}

      {/* Métricas resumen */}
      {(totalCosts > 0 || totalAmount > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground ">Total Costos</p>
                <p className="text-2xl font-bold text-foreground ">
                  {totalCosts}
                </p>
              </div>
              <div className="bg-info-soft p-2 rounded-lg">
                <span className="size-5 text-info-text text-xl">📊</span>
              </div>
            </div>
          </div>

          <div className="bg-card p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground ">Monto Total</p>
                <p className="text-2xl font-bold text-success-text">
                  {formatCurrency(totalAmount)}
                </p>
              </div>
              <div className="bg-success-soft p-2 rounded-lg">
                <span className="text-success-text text-xl font-bold">$</span>
              </div>
            </div>
          </div>

          <div className="bg-card p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground ">Promedio</p>
                <p className="text-lg font-semibold text-foreground ">
                  {totalCosts > 0 ? formatCurrency(totalAmount / totalCosts) : formatCurrency(0)}
                </p>
              </div>
              <div className="bg-warning-soft p-2 rounded-lg">
                <span className="text-warning-text text-sm font-bold">AVG</span>
              </div>
            </div>
          </div>

          <div className="bg-card p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground ">Este Mes</p>
                <p className="text-lg font-semibold text-primary">
                  {formatCurrency(currentMonthTotal)}
                </p>
                {monthVariation !== 0 && (
                  <div className="flex items-center mt-1">
                    {monthVariation > 0 ? (
                      <TrendingUp className="size-3 text-danger-text mr-1" />
                    ) : (
                      <TrendingDown className="size-3 text-success-text mr-1" />
                    )}
                    <span className={`text-xs ${monthVariation > 0 ? 'text-danger-text' : 'text-success-text'}`}>
                      {Math.abs(monthVariation).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
              <div className="bg-accent p-2 rounded-lg">
                <span className="text-primary text-xl">📊</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
          <Input
            placeholder="Buscar por descripción, categoría, folio..."
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          {/* Toggle de vista */}
          {onViewModeChange && (
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('table')}
                className="rounded-r-none border-r"
              >
                <Table className="size-4" />
              </Button>
              <Button
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('cards')}
                className="rounded-l-none"
              >
                <Grid3X3 className="size-4" />
              </Button>
            </div>
          )}
          
          {/* Filtros */}
          {filters && onFiltersChange && onClearFilters && (
            <CostFiltersComponent
              filters={filters}
              onFiltersChange={onFiltersChange}
              onClearFilters={onClearFilters}
            />
          )}
          
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport} className="whitespace-nowrap">
              <Download className="size-4 sm:mr-2" />
              <span className="hidden sm:inline">Exportar Excel</span>
              <span className="sm:hidden">Excel</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
