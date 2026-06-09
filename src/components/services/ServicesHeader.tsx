import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { Plus, Upload, RefreshCw, FileDown, Table, BarChart3, Eye, EyeOff } from 'lucide-react';
import { ServicesMetrics } from './ServicesMetrics';
import { ServicesDateFilter, DateFilter } from './ServicesDateFilter';
import { useServicesMetrics } from '@/hooks/services/useServicesMetrics';
import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

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
  dateFilter: DateFilter | 'custom';
  onDateFilterChange: (filter: DateFilter) => void;
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
  onViewModeChange,
  dateFilter,
  onDateFilterChange,
}: ServicesHeaderProps) => {
  // Metrics use the last explicitly-selected button (not affected by manual input edits)
  const [metricsFilter, setMetricsFilter] = useState<DateFilter>('month');
  useEffect(() => {
    if (dateFilter !== 'custom') setMetricsFilter(dateFilter);
  }, [dateFilter]);
  const { metrics, loading } = useServicesMetrics(metricsFilter);
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
      <SectionCard
        className="border-border bg-card"
        contentClassName="space-y-4"
        title={
          <PageHeader
            title="Gestión de Servicios"
            description={!isMobile ? 'Administra todos los servicios de grúa del sistema' : undefined}
            actions={
              <div className={`flex ${isMobile ? 'w-full flex-col gap-2' : 'flex-wrap items-center gap-2'}`}>
                <ToggleGroup
                  type="single"
                  value={viewMode}
                  onValueChange={(value) => value && onViewModeChange(value as ViewMode)}
                  className="rounded-md border border-border bg-muted p-1"
                >
                  <ToggleGroupItem value="table" size="sm" className="gap-1.5 px-3">
                    <Table className="size-4" />
                    {!isMobile && 'Tabla'}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="pipeline" size="sm" className="gap-1.5 px-3">
                    <BarChart3 className="size-4" />
                    {!isMobile && 'Pipeline'}
                  </ToggleGroupItem>
                </ToggleGroup>

                <Button
                  variant="outline"
                  size={isMobile ? 'sm' : 'default'}
                  onClick={onRefresh}
                  disabled={refreshing}
                  className="border-border/70 bg-card/70"
                >
                  <RefreshCw className={`size-4 ${!isMobile ? 'mr-2' : ''} ${refreshing ? 'animate-spin' : ''}`} />
                  {!isMobile && 'Actualizar'}
                </Button>

                {isAdmin && (
                  <>
                    <Button
                      onClick={onExportPending}
                      disabled={isExportingPending || pendingServicesCount === 0}
                      variant="outline"
                      size={isMobile ? 'sm' : 'default'}
                      className="border-warning/20 bg-warning/10 text-foreground hover:bg-warning/15"
                      title={pendingServicesCount === 0 ? "No hay servicios pendientes" : "Exportar servicios pendientes a PDF"}
                    >
                      <FileDown className={`size-4 ${!isMobile ? 'mr-2' : ''} ${isExportingPending ? 'animate-bounce' : ''}`} />
                      {!isMobile ? `Exportar Pendientes (${pendingServicesCount})` : `(${pendingServicesCount})`}
                    </Button>

                    <Button
                      onClick={onCSVUpload}
                      variant="outline"
                      size={isMobile ? 'sm' : 'default'}
                      className="border-info/20 bg-info/10 text-foreground hover:bg-info/15"
                      title="Cargar servicios desde un archivo CSV"
                    >
                      <Upload className="size-4" />
                      {!isMobile && <span className="ml-2">Carga Masiva</span>}
                    </Button>

                    <Button
                      size={isMobile ? 'default' : 'lg'}
                      className={isMobile ? 'w-full' : ''}
                      title="Crear un nuevo servicio"
                      onClick={onNewService}
                    >
                      <Plus className={`${isMobile ? 'size-5 mr-2' : 'size-5 mr-2'}`} />
                      Nuevo Servicio
                    </Button>
                  </>
                )}
              </div>
            }
          />
        }
      >
        <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between'}`}>
          <div className="flex items-center gap-3">
            <h2 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-foreground`}>Métricas de Servicios</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSensitiveData(!showSensitiveData)}
              title={showSensitiveData ? "Ocultar información sensible" : "Mostrar información sensible"}
              className="size-8"
            >
              {showSensitiveData ? (
                <Eye className="size-4 text-muted-foreground" />
              ) : (
                <EyeOff className="size-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          <ServicesDateFilter
            selected={dateFilter}
            onChange={onDateFilterChange}
          />
        </div>
        
        {loading ? (
          <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'}`}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-24 rounded-lg bg-muted"></div>
              </div>
            ))}
          </div>
        ) : (
          <ServicesMetrics metrics={metrics} showSensitiveData={showSensitiveData} />
        )}
      </SectionCard>
    </div>
  );
};
