
import { Button } from '@/components/ui/button';
import { Plus, Upload, RefreshCw, FileDown, Table, BarChart3 } from 'lucide-react';
import { GlobalRefreshButton } from './GlobalRefreshButton';
import { ServicesMetrics } from './ServicesMetrics';
import { ServicesDateFilter } from './ServicesDateFilter';
import { useServicesMetrics } from '@/hooks/services/useServicesMetrics';
import { useState } from 'react';

type DateFilter = 'today' | 'week' | 'month' | 'all';

type ViewMode = 'table' | 'pipeline';

interface ServicesHeaderProps {
  isAdmin: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onCSVUpload: () => void;
  onNewService: () => void;
  onExportPending: () => void;
  isExportingPending: boolean;
  pendingServicesCount: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export const ServicesHeader = ({ 
  isAdmin, 
  refreshing, 
  onRefresh, 
  onCSVUpload, 
  onNewService,
  onExportPending,
  isExportingPending,
  pendingServicesCount,
  viewMode,
  onViewModeChange
}: ServicesHeaderProps) => {
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const { metrics, loading } = useServicesMetrics(dateFilter);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between bg-white p-6 rounded-lg border">
        <div>
          <h1 className="text-3xl font-bold text-black">Gestión de Servicios</h1>
          <p className="text-gray-600 mt-2">
            Administra todos los servicios de grúa del sistema
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 w-full">
          <div className="flex items-center space-x-2">
            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('table')}
                className={viewMode === 'table' ? 'bg-white shadow-sm' : ''}
              >
                <Table className="w-4 h-4 mr-1" />
                Tabla
              </Button>
              <Button
                variant={viewMode === 'pipeline' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('pipeline')}
                className={viewMode === 'pipeline' ? 'bg-white shadow-sm' : ''}
              >
                <BarChart3 className="w-4 h-4 mr-1" />
                Pipeline
              </Button>
            </div>

            <GlobalRefreshButton />
            {isAdmin && (
              <>
                <Button 
                  onClick={onExportPending}
                  disabled={isExportingPending || pendingServicesCount === 0}
                  variant="outline"
                  className="border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                  title={pendingServicesCount === 0 ? "No hay servicios pendientes" : "Exportar servicios pendientes a PDF"}
                >
                  <FileDown className={`w-4 h-4 mr-2 ${isExportingPending ? 'animate-bounce' : ''}`} />
                  Exportar Pendientes ({pendingServicesCount})
                </Button>
                <Button 
                  onClick={onCSVUpload}
                  variant="outline"
                  className="border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  title="Cargar servicios desde un archivo CSV"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Carga Masiva
                </Button>
              </>
            )}
          </div>
          {isAdmin && (
            <Button 
              size="lg"
              className="bg-purple-400 hover:bg-purple-500 text-white font-bold text-lg px-8 py-6 shadow-lg"
              title="Crear un nuevo servicio"
              onClick={onNewService}
            >
              <Plus className="w-6 h-6 mr-3" />
              Nuevo Servicio
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Section */}
      <div className="bg-white p-6 rounded-lg border space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black">Métricas de Servicios</h2>
          <ServicesDateFilter 
            selected={dateFilter} 
            onChange={setDateFilter} 
          />
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 h-24 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : (
          <ServicesMetrics metrics={metrics} />
        )}
      </div>
    </div>
  );
};
