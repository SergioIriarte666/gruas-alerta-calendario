import { Button } from '@/components/ui/button';
import { Plus, Upload, RefreshCw, FileDown, Table, BarChart3, Eye, EyeOff, Activity } from 'lucide-react';
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
    <section className="space-y-5" aria-labelledby="services-heading">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="dashboard-section-kicker">
            <Activity className="size-3.5" />
            Operación
          </span>
          <h1 id="services-heading" className="dashboard-section-title">Control de servicios</h1>
          <p className="dashboard-section-description">Seguimiento de estados, asignaciones y facturación.</p>
        </div>

        <div className={`flex ${isMobile ? 'w-full flex-col gap-2' : 'flex-wrap items-center justify-end gap-2'}`}>
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => value && onViewModeChange(value as ViewMode)}
            className="services-view-toggle"
            aria-label="Vista de servicios"
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

          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing} className="border-border/70 bg-background/70">
            <RefreshCw className={`size-4 ${!isMobile ? 'mr-2' : ''} ${refreshing ? 'animate-spin' : ''}`} />
            {!isMobile && 'Actualizar'}
          </Button>

          {isAdmin && (
            <>
              <Button
                onClick={onExportPending}
                disabled={isExportingPending || pendingServicesCount === 0}
                variant="outline"
                size="sm"
                className="border-warning/25 bg-warning/10 text-foreground hover:bg-warning/15"
                title={pendingServicesCount === 0 ? 'No hay servicios pendientes' : 'Exportar servicios pendientes a PDF'}
              >
                <FileDown className={`size-4 ${!isMobile ? 'mr-2' : ''} ${isExportingPending ? 'animate-bounce' : ''}`} />
                {!isMobile ? `Pendientes (${pendingServicesCount})` : `Pendientes (${pendingServicesCount})`}
              </Button>
              <Button onClick={onCSVUpload} variant="outline" size="sm" className="border-border/70 bg-background/70" title="Cargar servicios desde un archivo CSV">
                <Upload className="size-4" />
                {!isMobile && <span className="ml-2">Carga masiva</span>}
              </Button>
              <Button size="sm" className={`dashboard-report-button ${isMobile ? 'w-full' : ''}`} title="Crear un nuevo servicio" onClick={onNewService}>
                <Plus className="mr-2 size-4" />
                Nuevo servicio
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="services-toolbar space-y-4 p-4 sm:p-5">
        <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between gap-4'}`}>
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground sm:text-base">Pulso del período</h2>
              {!isMobile && <p className="mt-0.5 text-xs text-muted-foreground">Valores calculados según el rango seleccionado.</p>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSensitiveData(!showSensitiveData)}
              title={showSensitiveData ? "Ocultar información sensible" : "Mostrar información sensible"}
              className="size-8 rounded-full"
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-36 rounded-2xl bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <ServicesMetrics metrics={metrics} showSensitiveData={showSensitiveData} />
        )}
      </div>
    </section>
  );
};
