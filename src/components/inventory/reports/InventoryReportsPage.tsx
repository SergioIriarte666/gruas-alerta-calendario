import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { Download, Filter, Calendar, TrendingUp, Package, BarChart3, Zap } from 'lucide-react';
import { StockReportView } from './StockReportView';
import { MovementReportView } from './MovementReportView';
import { CostAnalysisView } from './CostAnalysisView';
import { PredictiveAnalysisView } from './PredictiveAnalysisView';
import { ExecutiveDashboard } from './ExecutiveDashboard';
import { ReportFilters } from './ReportFilters';
import { ExportOptions } from './ExportOptions';
import { InventoryReportFilters } from '@/hooks/useInventoryReports';
import type { InventoryEntityFilter } from '@/utils/inventoryEntity';

interface InventoryReportsPageProps {
  entityFilter?: InventoryEntityFilter;
}

export const InventoryReportsPage: React.FC<InventoryReportsPageProps> = ({ entityFilter = 'all' }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filters, setFilters] = useState<InventoryReportFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const effectiveFilters = { ...filters, entityFilter };

  const tabs = [
    {
      id: 'dashboard',
      label: 'Dashboard Ejecutivo',
      icon: BarChart3,
      component: ExecutiveDashboard
    },
    {
      id: 'stock',
      label: 'Estado de Stock',
      icon: Package,
      component: StockReportView
    },
    {
      id: 'movements',
      label: 'Movimientos',
      icon: TrendingUp,
      component: MovementReportView
    },
    {
      id: 'costs',
      label: 'Análisis de Costos',
      icon: Calendar,
      component: CostAnalysisView
    },
    {
      id: 'predictive',
      label: 'Análisis Predictivo',
      icon: Zap,
      component: PredictiveAnalysisView
    }
  ];

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes de Inventario"
        description="Consulta indicadores, stock, movimientos, costos y proyecciones desde un workspace analítico unificado."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 border-border/70 bg-background/60"
            >
              <Filter className="size-4" />
              Filtros
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowExportOptions(!showExportOptions)}
              className="flex items-center gap-2 border-border/70 bg-background/60"
            >
              <Download className="size-4" />
              Exportar
            </Button>
          </div>
        }
      />

      {showFilters && (
        <SectionCard
          title="Filtros de reporte"
          description="Personaliza el conjunto de datos mostrado en cada análisis."
          className="border-border/70 bg-card/80 shadow-sm"
        >
          <CardContent className="p-0 pt-0">
            <ReportFilters filters={filters} onFiltersChange={setFilters} />
          </CardContent>
        </SectionCard>
      )}

      {showExportOptions && (
        <SectionCard
          title="Opciones de exportación"
          description="Genera salidas del reporte activo con los filtros aplicados."
          className="border-border/70 bg-card/80 shadow-sm"
        >
          <CardContent className="p-0 pt-0">
            <ExportOptions 
              activeReport={activeTab} 
              filters={effectiveFilters}
              onClose={() => setShowExportOptions(false)}
            />
          </CardContent>
        </SectionCard>
      )}

      <SectionCard flush className="inventory-panel border-border/70 bg-card/80 shadow-sm" contentClassName="space-y-4">
        <div className="flex flex-wrap gap-2 px-6 pt-6">
          <Badge className="gap-1 border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
            <BarChart3 className="size-3.5" />
            Analítica operativa
          </Badge>
          <Badge variant="outline" className="gap-1 rounded-full px-3 py-1">
            <TrendingUp className="size-3.5" />
            Reporte activo: {activeTabData?.label}
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 px-6 pb-6">
          <div className="overflow-x-auto">
            <TabsList className="inventory-tabs grid h-auto w-full min-w-[47.5rem] grid-cols-5 p-1">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2 rounded-lg text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <tab.icon className="size-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="space-y-4">
              <Card className="border-border/70 bg-background/50 shadow-none">
                <CardContent className="space-y-4 p-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-foreground">
                      <tab.icon className="size-5 text-primary" />
                      <h2 className="text-lg font-semibold">{tab.label}</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {tab.id === 'dashboard' && 'Vista general de métricas clave y KPIs del inventario.'}
                      {tab.id === 'stock' && 'Estado actual del inventario, stock bajo y valorización.'}
                      {tab.id === 'movements' && 'Análisis detallado de entradas y salidas de inventario.'}
                      {tab.id === 'costs' && 'Análisis financiero de costos y proveedores.'}
                      {tab.id === 'predictive' && 'Proyecciones y análisis predictivo de demanda.'}
                    </p>
                  </div>
                  <tab.component filters={effectiveFilters} />
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </SectionCard>
    </div>
  );
};
