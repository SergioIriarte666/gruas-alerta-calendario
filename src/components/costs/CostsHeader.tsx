
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Gestión de Costos
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Administra y registra todos los costos operativos de la empresa
            {dateFilter !== 'all' && (
              <span className="ml-2 px-2 py-1 bg-tms-green/10 text-tms-green rounded-full text-xs font-medium">
                Mostrando: {getActivePeriodLabel()}
              </span>
            )}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={onAddCost}
            className="bg-tms-green hover:bg-tms-green/80 text-black hover-scale"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Costo
          </Button>
          
          <Button 
            onClick={onXMLUpload}
            variant="outline"
            className="border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white"
          >
            <Code className="w-4 h-4 mr-2" />
            Cargar XML
          </Button>
        </div>
      </div>

      {/* Filtros rápidos de fecha */}
      {onDateFilterChange && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Costos</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {totalCosts}
                </p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                <span className="w-5 h-5 text-blue-600 dark:text-blue-400 text-xl">📊</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Monto Total</p>
                <p className="text-2xl font-bold text-tms-green">
                  {formatCurrency(totalAmount)}
                </p>
              </div>
              <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
                <span className="text-green-600 dark:text-green-400 text-xl font-bold">$</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Promedio</p>
                <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                  {totalCosts > 0 ? formatCurrency(totalAmount / totalCosts) : formatCurrency(0)}
                </p>
              </div>
              <div className="bg-orange-100 dark:bg-orange-900 p-2 rounded-lg">
                <span className="text-orange-600 dark:text-orange-400 text-sm font-bold">AVG</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Este Mes</p>
                <p className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                  {formatCurrency(currentMonthTotal)}
                </p>
                {monthVariation !== 0 && (
                  <div className="flex items-center mt-1">
                    {monthVariation > 0 ? (
                      <TrendingUp className="w-3 h-3 text-red-500 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-green-500 mr-1" />
                    )}
                    <span className={`text-xs ${monthVariation > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {Math.abs(monthVariation).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
              <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
                <span className="text-purple-600 dark:text-purple-400 text-xl">📊</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar por descripción, categoría, folio..."
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          {/* Toggle de vista */}
          {onViewModeChange && (
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('table')}
                className="rounded-r-none border-r"
              >
                <Table className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('cards')}
                className="rounded-l-none"
              >
                <Grid3X3 className="w-4 h-4" />
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
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="w-4 h-4 mr-2" />
              Exportar Excel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
