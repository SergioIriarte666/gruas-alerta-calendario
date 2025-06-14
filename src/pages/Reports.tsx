
import React, { useState, useMemo } from 'react';
import { useReports, ReportFilters as ReportFiltersType } from '@/hooks/useReports';
import { ChartConfig } from "@/components/ui/chart";
import { ReportsHeader } from '@/components/reports/ReportsHeader';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { MainMetrics } from '@/components/reports/MainMetrics';
import { PrimaryCharts } from '@/components/reports/PrimaryCharts';
import { DistributionCharts } from '@/components/reports/DistributionCharts';
import { DetailTables } from '@/components/reports/DetailTables';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useClients } from '@/hooks/useClients';
import { useCranes } from '@/hooks/useCranes';
import { useOperators } from '@/hooks/useOperators';
import { useSettings } from '@/hooks/useSettings';

const Reports = () => {
  const defaultFilters: ReportFiltersType = {
    dateRange: {
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      to: new Date().toISOString().split('T')[0]
    },
    clientId: 'all',
    craneId: 'all',
    operatorId: 'all',
  };
  
  const [filters, setFilters] = useState<ReportFiltersType>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<ReportFiltersType>(defaultFilters);

  const { metrics, loading } = useReports(appliedFilters);
  const { settings } = useSettings();

  const { clients } = useClients();
  const { cranes } = useCranes();
  const { operators } = useOperators();

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, [field]: value } }));
  };

  const handleFilterChange = (field: 'clientId' | 'craneId' | 'operatorId', value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleUpdate = () => {
    setAppliedFilters(filters);
  };
  
  const handleClearFilters = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

  const getAppliedFilterLabels = () => {
    const clientLabel = appliedFilters.clientId === 'all' 
        ? 'Todos los clientes' 
        : clients.find(c => c.id === appliedFilters.clientId)?.name || appliedFilters.clientId;
    const craneData = cranes.find(c => c.id === appliedFilters.craneId);
    const craneLabel = appliedFilters.craneId === 'all'
        ? 'Todas las grúas'
        : craneData ? `${craneData.brand} ${craneData.model} (${craneData.licensePlate})` : appliedFilters.craneId;
    const operatorLabel = appliedFilters.operatorId === 'all'
        ? 'Todos los operadores'
        : operators.find(o => o.id === appliedFilters.operatorId)?.name || appliedFilters.operatorId;

    return [
        [`Rango de Fechas: ${appliedFilters.dateRange.from} a ${appliedFilters.dateRange.to}`],
        [`Cliente: ${clientLabel}`],
        [`Grúa: ${craneLabel}`],
        [`Operador: ${operatorLabel}`]
    ];
  }

  const handleExport = async (format: 'pdf' | 'excel') => {
    if (!metrics || !settings) return;
    
    const { company } = settings;
    const exportFileDefaultName = `reporte-${appliedFilters.dateRange.from}-a-${appliedFilters.dateRange.to}`;

    if (format === 'pdf') {
        const doc = new jsPDF();
        let startY = 15;

        // Logo
        if (company.logo) {
            try {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.src = company.logo;
                await new Promise((resolve, reject) => {
                    img.onload = () => {
                        const pageWidth = doc.internal.pageSize.getWidth();
                        const logoWidth = 35;
                        const logoHeight = (img.height * logoWidth) / img.width;
                        doc.addImage(img, 'PNG', pageWidth - 14 - logoWidth, startY, logoWidth, logoHeight);
                        resolve(true);
                    };
                    img.onerror = (e) => {
                        console.error("Error loading logo for PDF", e);
                        reject(e);
                    };
                });
            } catch (e) {
                console.error("Could not add logo to PDF.", e);
            }
        }
        
        // Company Info
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text(company.name, 14, startY + 7);
        doc.setFont(undefined, 'normal');

        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`RUT: ${company.taxId}`, 14, startY + 14);
        doc.text(company.address, 14, startY + 19);
        doc.text(`Tel: ${company.phone} | Email: ${company.email}`, 14, startY + 24);
        
        startY += 40;

        // Filters
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.text('Filtros Aplicados:', 14, startY);
        autoTable(doc, { body: getAppliedFilterLabels(), startY: startY + 4, theme: 'plain', styles: { fontSize: 9 } });

        let lastY = (doc as any).lastAutoTable.finalY;

        // Main Metrics
        doc.setFontSize(11);
        doc.text('Métricas Principales:', 14, lastY + 10);
        autoTable(doc, {
            body: [
                ['Total Servicios', metrics.totalServices],
                ['Ingresos Totales', `$${metrics.totalRevenue.toLocaleString()}`],
                ['Valor Promedio', `$${metrics.averageServiceValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
                ['Facturas Pendientes', `${metrics.pendingInvoices} (${metrics.overdueInvoices} vencidas)`],
            ],
            startY: lastY + 14,
            theme: 'grid'
        });
        lastY = (doc as any).lastAutoTable.finalY;

        if (metrics.topClients.length > 0) {
            doc.text('Top Clientes por Ingresos:', 14, lastY + 10);
            autoTable(doc, {
                head: [['#', 'Cliente', 'Servicios', 'Ingresos']],
                body: metrics.topClients.map((c, i) => [i + 1, c.clientName, c.services, `$${c.revenue.toLocaleString()}`]),
                startY: lastY + 14
            });
            lastY = (doc as any).lastAutoTable.finalY;
        }

        if (metrics.craneUtilization.length > 0) {
            doc.text('Utilización de Grúas:', 14, lastY + 10);
            autoTable(doc, {
                head: [['Grúa', 'Servicios', 'Utilización (%)']],
                body: metrics.craneUtilization.map(c => [c.craneName, c.services, `${c.utilization.toFixed(1)}%`]),
                startY: lastY + 14
            });
        }
        
        doc.save(`${exportFileDefaultName}.pdf`);

    } else if (format === 'excel') {
        const wb = XLSX.utils.book_new();

        const resumen_ws_data = [
            [company.name],
            [`RUT: ${company.taxId}`],
            [company.address],
            [`Tel: ${company.phone} | Email: ${company.email}`],
            company.logo ? [`Logo: ${company.logo}`] : [],
            [],
            ['Reporte de Operaciones'], [],
            ['Filtros Aplicados'],
            ...getAppliedFilterLabels(), [],
            ['Métricas Principales'],
            ['Métrica', 'Valor'],
            ['Total Servicios', metrics.totalServices],
            ['Ingresos Totales', metrics.totalRevenue],
            ['Valor Promedio', metrics.averageServiceValue],
            ['Facturas Pendientes', metrics.pendingInvoices],
            ['Facturas Vencidas', metrics.overdueInvoices],
            ['Clientes Activos', metrics.activeClients],
            ['Grúas Activas', metrics.activeCranes],
            ['Operadores Activos', metrics.activeOperators],
        ];
        const resumen_ws = XLSX.utils.aoa_to_sheet(resumen_ws_data);
        XLSX.utils.book_append_sheet(wb, resumen_ws, 'Resumen');

        if(metrics.servicesByMonth.length > 0) {
            const services_month_ws = XLSX.utils.json_to_sheet(metrics.servicesByMonth);
            XLSX.utils.book_append_sheet(wb, services_month_ws, 'Servicios por Mes');
        }

        if(metrics.topClients.length > 0) {
            const top_clients_ws = XLSX.utils.json_to_sheet(metrics.topClients.map(c => ({ 'Cliente': c.clientName, 'Servicios': c.services, 'Ingresos': c.revenue })));
            XLSX.utils.book_append_sheet(wb, top_clients_ws, 'Top Clientes');
        }

        if(metrics.craneUtilization.length > 0) {
            const crane_util_ws = XLSX.utils.json_to_sheet(metrics.craneUtilization.map(c => ({ 'Grúa': c.craneName, 'Servicios': c.services, 'Utilización (%)': c.utilization })));
            XLSX.utils.book_append_sheet(wb, crane_util_ws, 'Utilización Grúas');
        }

        if(metrics.servicesByStatus.length > 0) {
            const services_status_ws = XLSX.utils.json_to_sheet(metrics.servicesByStatus);
            XLSX.utils.book_append_sheet(wb, services_status_ws, 'Servicios por Estado');
        }

        XLSX.writeFile(wb, `${exportFileDefaultName}.xlsx`);
    }
  };

  const servicesByMonthConfig = { services: { label: 'Servicios', color: '#10b981' } } satisfies ChartConfig;
  const revenueByMonthConfig = { revenue: { label: 'Ingresos', color: '#3b82f6' } } satisfies ChartConfig;
  const craneUtilizationConfig = { utilization: { label: 'Utilización', color: '#f59e0b' } } satisfies ChartConfig;
  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

  const servicesByStatusConfig = useMemo(() => {
    if (!metrics) return {};
    return metrics.servicesByStatus.reduce((acc, item, index) => {
        acc[item.status] = {
            label: item.status,
            color: COLORS[index % COLORS.length]
        };
        return acc;
    }, {} as ChartConfig);
  }, [metrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Generando reportes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ReportsHeader onExport={handleExport} />
      <ReportFilters 
        filters={filters}
        onDateChange={handleDateChange}
        onFilterChange={handleFilterChange}
        onUpdate={handleUpdate}
        onClear={handleClearFilters}
      />

      {metrics && (
        <div className="space-y-6">
          <MainMetrics metrics={metrics} />
          <PrimaryCharts 
            metrics={metrics} 
            servicesByMonthConfig={servicesByMonthConfig} 
            revenueByMonthConfig={revenueByMonthConfig}
          />
          <DistributionCharts 
            metrics={metrics}
            servicesByStatusConfig={servicesByStatusConfig}
            craneUtilizationConfig={craneUtilizationConfig}
          />
          <DetailTables metrics={metrics} />
        </div>
      )}
    </div>
  );
};

export default Reports;

