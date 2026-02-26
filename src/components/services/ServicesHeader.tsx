
import { Button } from '@/components/ui/button';
import { Plus, Upload, RefreshCw, FileDown, Table, BarChart3, Eye, EyeOff } from 'lucide-react';
import { GlobalRefreshButton } from './GlobalRefreshButton';
import { ServicesMetrics } from './ServicesMetrics';
import { ServicesDateFilter } from './ServicesDateFilter';
import { useServicesMetrics } from '@/hooks/services/useServicesMetrics';
import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
  
  // Estado para visibilidad de datos sensibles
  const [showSensitiveData, setShowSensitiveData] = useState(() => {
    const saved = localStorage.getItem('showSensitiveData');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Persistir preferencia en localStorage
  useEffect(() => {
    localStorage.setItem('showSensitiveData', JSON.stringify(showSensitiveData));
  }, [showSensitiveData]);

  return (
    <div className={isMobile ? "space-y-3" : "space-y-6"}>
      {/* Header Section */}
      <div className={`flex ${isMobile ? 'flex-col gap-3 p-3' : 'items-center justify-between p-6'} bg-white rounded-lg border`}>
        <div>
          <h1 className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold text-black`}>Gestión de Servicios</h1>
          {!isMobile && (
            <p className="text-gray-600 mt-2">
              Administra todos los servicios de grúa del sistema
            </p>
          )}
        </div>
        <div className={`flex flex-col items-center gap-2 ${isMobile ? '' : 'w-full'}`}>
          <div className={`flex items-center ${isMobile ? 'flex-wrap gap-2' : 'space-x-2'}`}>
            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('table')}
                className={viewMode === 'table' ? 'bg-white shadow-sm' : ''}
              >
                <Table className="w-4 h-4 mr-1" />
                {!isMobile && 'Tabla'}
              </Button>
              <Button
                variant={viewMode === 'pipeline' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('pipeline')}
                className={viewMode === 'pipeline' ? 'bg-white shadow-sm' : ''}
              >
                <BarChart3 className="w-4 h-4 mr-1" />
                {!isMobile && 'Pipeline'}
              </Button>
            </div>

            <GlobalRefreshButton />
            {isAdmin && (
              <>
                <Button 
                  onClick={onExportPending}
                  disabled={isExportingPending || pendingServicesCount === 0}
                  variant="outline"
                  size={isMobile ? 'sm' : 'default'}
                  className="border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                  title={pendingServicesCount === 0 ? "No hay servicios pendientes" : "Exportar servicios pendientes a PDF"}
                >
                  <FileDown className={`w-4 h-4 ${isMobile ? '' : 'mr-2'} ${isExportingPending ? 'animate-bounce' : ''}`} />
                  {!isMobile && `Exportar Pendientes (${pendingServicesCount})`}
                  {isMobile && `(${pendingServicesCount})`}
                </Button>
                <Button 
                  onClick={onCSVUpload}
                  variant="outline"
                  size={isMobile ? 'sm' : 'default'}
                  className="border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  title="Cargar servicios desde un archivo CSV"
                >
                  <Upload className="w-4 h-4" />
                  {!isMobile && <span className="ml-2">Carga Masiva</span>}
                </Button>
              </>
            )}
          </div>
          {isAdmin && (
            <Button 
              size={isMobile ? 'default' : 'lg'}
              className={`bg-purple-400 hover:bg-purple-500 text-white font-bold ${isMobile ? 'w-full text-base px-4 py-3' : 'text-lg px-8 py-6'} shadow-lg`}
              title="Crear un nuevo servicio"
              onClick={onNewService}
            >
              <Plus className={`${isMobile ? 'w-5 h-5 mr-2' : 'w-6 h-6 mr-3'}`} />
              Nuevo Servicio
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Section */}
      <div className={`bg-white ${isMobile ? 'p-3' : 'p-6'} rounded-lg border space-y-4`}>
        <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between'}`}>
          <div className="flex items-center gap-3">
            <h2 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-black`}>Métricas de Servicios</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSensitiveData(!showSensitiveData)}
              title={showSensitiveData ? "Ocultar información sensible" : "Mostrar información sensible"}
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              {showSensitiveData ? (
                <Eye className="h-4 w-4 text-gray-600" />
              ) : (
                <EyeOff className="h-4 w-4 text-gray-400" />
              )}
            </Button>
          </div>
          <ServicesDateFilter 
            selected={dateFilter} 
            onChange={setDateFilter} 
          />
        </div>
        
        {loading ? (
          <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'}`}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 h-24 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : (
          <ServicesMetrics metrics={metrics} showSensitiveData={showSensitiveData} />
        )}
      </div>
    </div>
  );
};
