import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { MaintenanceReportData, MaintenanceReportFilters } from '@/hooks/reports/useMaintenanceReport';
import { Settings } from '@/types/settings';
import { createExportFileName, addCompanyHeader } from './reportUtils';

export interface ExportMaintenanceReportArgs {
  format: 'pdf' | 'excel';
  data: MaintenanceReportData;
  settings: Settings;
  appliedFilters: MaintenanceReportFilters;
  filterLabels: string[][];
}

export const exportMaintenanceReport = async ({ 
  format, 
  data, 
  settings, 
  appliedFilters, 
  filterLabels 
}: ExportMaintenanceReportArgs) => {
  const { company } = settings;
  const exportFileDefaultName = createExportFileName(
    'reporte-mantenimiento', 
    appliedFilters.dateFrom, 
    appliedFilters.dateTo
  );

  if (format === 'pdf') {
    const doc = new jsPDF();
    let startY = await addCompanyHeader(doc, company, 15);

    // Title
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('Reporte de Mantenimiento y Partes', 14, startY);
    startY += 10;

    // Filters
    doc.setFontSize(11);
    doc.text('Filtros Aplicados:', 14, startY);
    autoTable(doc, { 
      body: filterLabels, 
      startY: startY + 4, 
      theme: 'plain', 
      styles: { fontSize: 9 } 
    });

    let lastY = (doc as any).lastAutoTable.finalY;

    // Main Metrics
    doc.setFontSize(11);
    doc.text('Métricas Principales:', 14, lastY + 10);
    autoTable(doc, {
      body: [
        ['Costo Total Mantenimiento', `$${data.totalMaintenanceCost.toLocaleString()}`],
        ['Costo Total Partes', `$${data.totalPartsCost.toLocaleString()}`],
        ['Total Intervenciones', data.totalInterventions],
        ['Costo Promedio Mantenimiento', `$${data.averageMaintenanceCost.toLocaleString()}`],
      ],
      startY: lastY + 14,
      theme: 'grid'
    });
    lastY = (doc as any).lastAutoTable.finalY;

    // Top Providers
    if (data.topProviders.length > 0) {
      doc.text('Top Proveedores:', 14, lastY + 10);
      autoTable(doc, {
        head: [['#', 'Proveedor', 'Intervenciones', 'Costo Total']],
        body: data.topProviders.slice(0, 10).map((p, i) => [
          i + 1, 
          p.provider, 
          p.interventionCount, 
          `$${p.totalCost.toLocaleString()}`
        ]),
        startY: lastY + 14
      });
      lastY = (doc as any).lastAutoTable.finalY;
    }

    // Crane Analysis
    if (data.craneAnalysis.length > 0) {
      // Add new page if needed
      if (lastY > 250) {
        doc.addPage();
        lastY = 20;
      }
      
      doc.text('Análisis por Grúa:', 14, lastY + 10);
      autoTable(doc, {
        head: [['Grúa', 'Mantenimiento', 'Partes', 'Total', 'Intervenciones']],
        body: data.craneAnalysis.map(c => [
          c.licensePlate,
          `$${c.totalMaintenanceCost.toLocaleString()}`,
          `$${c.totalPartsCost.toLocaleString()}`,
          `$${(c.totalMaintenanceCost + c.totalPartsCost).toLocaleString()}`,
          c.interventionCount
        ]),
        startY: lastY + 14
      });
      lastY = (doc as any).lastAutoTable.finalY;
    }

    // Maintenance by Type
    if (data.maintenanceByType.length > 0) {
      if (lastY > 220) {
        doc.addPage();
        lastY = 20;
      }
      
      doc.text('Mantenimiento por Tipo:', 14, lastY + 10);
      autoTable(doc, {
        head: [['Tipo', 'Cantidad', 'Costo Total']],
        body: data.maintenanceByType.map(m => [
          m.type,
          m.count,
          `$${m.cost.toLocaleString()}`
        ]),
        startY: lastY + 14
      });
    }

    doc.save(`${exportFileDefaultName}.pdf`);

  } else if (format === 'excel') {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const resumen_ws_data = [
      [company.name],
      [`RUT: ${company.taxId}`],
      [company.address],
      [`Tel: ${company.phone} | Email: ${company.email}`],
      [],
      ['Reporte de Mantenimiento y Partes'],
      [],
      ['Filtros Aplicados'],
      ...filterLabels,
      [],
      ['Métricas Principales'],
      ['Métrica', 'Valor'],
      ['Costo Total Mantenimiento', data.totalMaintenanceCost],
      ['Costo Total Partes', data.totalPartsCost],
      ['Total Intervenciones', data.totalInterventions],
      ['Costo Promedio Mantenimiento', data.averageMaintenanceCost],
    ];
    const resumen_ws = XLSX.utils.aoa_to_sheet(resumen_ws_data);
    XLSX.utils.book_append_sheet(wb, resumen_ws, 'Resumen');

    // Crane Analysis Sheet
    if (data.craneAnalysis.length > 0) {
      const crane_ws = XLSX.utils.json_to_sheet(
        data.craneAnalysis.map(c => ({
          'Grúa': `${c.licensePlate} - ${c.brand} ${c.model}`,
          'Costo Mantenimiento': c.totalMaintenanceCost,
          'Costo Partes': c.totalPartsCost,
          'Costo Total': c.totalMaintenanceCost + c.totalPartsCost,
          'Intervenciones': c.interventionCount,
          'Último Mantenimiento': c.lastMaintenance ? formatDate(new Date(c.lastMaintenance), 'dd/MM/yyyy', { locale: es }) : 'N/A',
          'Próximo Mantenimiento': c.nextMaintenance ? formatDate(new Date(c.nextMaintenance), 'dd/MM/yyyy', { locale: es }) : 'N/A',
        }))
      );
      XLSX.utils.book_append_sheet(wb, crane_ws, 'Análisis por Grúa');
    }

    // Providers Sheet
    if (data.topProviders.length > 0) {
      const providers_ws = XLSX.utils.json_to_sheet(
        data.topProviders.map(p => ({
          'Proveedor': p.provider,
          'Intervenciones': p.interventionCount,
          'Costo Total': p.totalCost,
        }))
      );
      XLSX.utils.book_append_sheet(wb, providers_ws, 'Proveedores');
    }

    // Maintenance by Type Sheet
    if (data.maintenanceByType.length > 0) {
      const maintenance_type_ws = XLSX.utils.json_to_sheet(
        data.maintenanceByType.map(m => ({
          'Tipo de Mantenimiento': m.type,
          'Cantidad': m.count,
          'Costo Total': m.cost,
        }))
      );
      XLSX.utils.book_append_sheet(wb, maintenance_type_ws, 'Por Tipo');
    }

    // Parts Analysis Sheet
    if (data.partsAnalysis.length > 0) {
      const parts_ws = XLSX.utils.json_to_sheet(
        data.partsAnalysis.map(p => ({
          'Parte': p.partName,
          'Proveedor': p.supplier,
          'Cantidad': p.quantity,
          'Costo Total': p.totalCost,
          'Grúas Afectadas': p.craneCount,
        }))
      );
      XLSX.utils.book_append_sheet(wb, parts_ws, 'Análisis de Partes');
    }

    // Monthly Trends Sheet
    if (data.monthlyTrends.length > 0) {
      const trends_ws = XLSX.utils.json_to_sheet(
        data.monthlyTrends.map(t => ({
          'Mes': formatDate(new Date(t.month + '-01'), 'MMM yyyy', { locale: es }),
          'Costo Mantenimiento': t.maintenanceCost,
          'Costo Partes': t.partsCost,
          'Total': t.maintenanceCost + t.partsCost,
          'Intervenciones': t.interventionCount,
        }))
      );
      XLSX.utils.book_append_sheet(wb, trends_ws, 'Tendencias Mensuales');
    }

    // Predictive Insights Sheet
    if (data.predictiveInsights.highCostCranes.length > 0 || data.predictiveInsights.frequentIssues.length > 0) {
      const insights_data = [
        ['Grúas de Alto Costo'],
        ['Grúa', 'Costo Total', 'Tendencia'],
        ...data.predictiveInsights.highCostCranes.map(c => [
          c.licensePlate,
          c.totalCost,
          c.trend
        ]),
        [],
        ['Problemas Frecuentes'],
        ['Problema', 'Frecuencia', 'Costo Promedio'],
        ...data.predictiveInsights.frequentIssues.map(i => [
          i.issue,
          i.frequency,
          i.avgCost
        ])
      ];
      const insights_ws = XLSX.utils.aoa_to_sheet(insights_data);
      XLSX.utils.book_append_sheet(wb, insights_ws, 'Insights Predictivos');
    }

    XLSX.writeFile(wb, `${exportFileDefaultName}.xlsx`);
  }
};
