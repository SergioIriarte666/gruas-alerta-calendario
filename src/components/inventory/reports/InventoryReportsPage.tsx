import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Download, Filter, Calendar, TrendingUp, Package, BarChart3, Zap } from 'lucide-react';
import { StockReportView } from './StockReportView';
import { MovementReportView } from './MovementReportView';
import { CostAnalysisView } from './CostAnalysisView';
import { PredictiveAnalysisView } from './PredictiveAnalysisView';
import { ExecutiveDashboard } from './ExecutiveDashboard';
import { ReportFilters } from './ReportFilters';
import { ExportOptions } from './ExportOptions';
import { InventoryReportFilters } from '@/hooks/useInventoryReports';

export const InventoryReportsPage = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filters, setFilters] = useState<InventoryReportFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reportes de Inventario</h1>
          <p className="text-muted-foreground">
            Sistema integral de análisis y reportes de inventario
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setShowExportOptions(!showExportOptions)}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle>Filtros de Reporte</CardTitle>
            <CardDescription>
              Personaliza los datos mostrados en los reportes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReportFilters filters={filters} onFiltersChange={setFilters} />
          </CardContent>
        </Card>
      )}

      {/* Export Options */}
      {showExportOptions && (
        <Card>
          <CardHeader>
            <CardTitle>Opciones de Exportación</CardTitle>
            <CardDescription>
              Exporta los reportes en diferentes formatos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExportOptions 
              activeReport={activeTab} 
              filters={filters}
              onClose={() => setShowExportOptions(false)}
            />
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-2"
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <tab.icon className="h-5 w-5" />
                  {tab.label}
                </CardTitle>
                <CardDescription>
                  {tab.id === 'dashboard' && 'Vista general de métricas clave y KPIs del inventario'}
                  {tab.id === 'stock' && 'Estado actual del inventario, stock bajo y valorización'}
                  {tab.id === 'movements' && 'Análisis detallado de entradas y salidas de inventario'}
                  {tab.id === 'costs' && 'Análisis financiero de costos y proveedores'}
                  {tab.id === 'predictive' && 'Proyecciones y análisis predictivo de demanda'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <tab.component filters={filters} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};