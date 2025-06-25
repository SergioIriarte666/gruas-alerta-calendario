
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExportReportArgs } from './reportTypes';
import { createExportFileName, addCompanyHeader } from './reportUtils';

export const exportOperationalReport = async ({ format, metrics, settings, appliedFilters, filterLabels }: ExportReportArgs) => {
  const { company } = settings;
  const exportFileDefaultName = createExportFileName('reporte', appliedFilters.dateRange.from, appliedFilters.dateRange.to);

  if (format === 'pdf') {
    const doc = new jsPDF();
    let startY = await addCompanyHeader(doc, company, 15);

    // Filters
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text('Filtros Aplicados:', 14, startY);
    autoTable(doc, { body: filterLabels, startY: startY + 4, theme: 'plain', styles: { fontSize: 9 } });

    let lastY = (doc as any).lastAutoTable.finalY;

    // Main Metrics
    doc.setFontSize(11);
    doc.text('Métricas Principales:', 14, lastY + 10);
    autoTable(doc, {
      body: [
        ['Total Servicios', metrics.totalServices],
        ['Ingresos Totales', `$${metrics.totalRevenue.toLocaleString()}`],
        ['Total Costos', `$${metrics.totalCosts.toLocaleString()}`],
        ['Beneficio Neto', `$${metrics.netProfit.toLocaleString()}`],
        ['Margen de Beneficio', `${metrics.profitMargin.toFixed(1)}%`],
        ['Costo Promedio/Servicio', `$${metrics.averageCostPerService.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`],
        ['Ratio Costo/Ingreso', `${metrics.costRevenueRatio.toFixed(1)}%`],
        ['Valor Promedio', `$${metrics.averageServiceValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ['Facturas Pendientes', `${metrics.pendingInvoices} (${metrics.overdueInvoices} vencidas)`],
      ],
      startY: lastY + 14,
      theme: 'grid'
    });
    lastY = (doc as any).lastAutoTable.finalY;

    // Top Clients
    if (metrics.topClients.length > 0) {
      doc.text('Top Clientes por Ingresos:', 14, lastY + 10);
      autoTable(doc, {
        head: [['#', 'Cliente', 'Servicios', 'Ingresos']],
        body: metrics.topClients.map((c, i) => [i + 1, c.clientName, c.services, `$${c.revenue.toLocaleString()}`]),
        startY: lastY + 14
      });
      lastY = (doc as any).lastAutoTable.finalY;
    }

    // Costs by Category
    if (metrics.costsByCategory.length > 0) {
      doc.text('Costos por Categoría:', 14, lastY + 10);
      autoTable(doc, {
        head: [['Categoría', 'Total', '% del Total']],
        body: metrics.costsByCategory.map(c => [c.categoryName, `$${c.total.toLocaleString()}`, `${c.percentage.toFixed(1)}%`]),
        startY: lastY + 14
      });
      lastY = (doc as any).lastAutoTable.finalY;
    }
    
    // Monthly Costs Trend
    if (metrics.costsByMonth.length > 0) {
      doc.text('Tendencia de Costos Mensuales:', 14, lastY + 10);
      autoTable(doc, {
        head: [['Mes', 'Costo Total']],
        body: metrics.costsByMonth.map(c => [formatDate(new Date(c.month + '-02T00:00:00'), "MMM yyyy", { locale: es }), `$${c.total.toLocaleString()}`]),
        startY: lastY + 14
      });
      lastY = (doc as any).lastAutoTable.finalY;
    }

    // Crane Utilization
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
      ...filterLabels, [],
      ['Métricas Principales'],
      ['Métrica', 'Valor'],
      ['Total Servicios', metrics.totalServices],
      ['Ingresos Totales', metrics.totalRevenue],
      ['Total Costos', metrics.totalCosts],
      ['Beneficio Neto', metrics.netProfit],
      ['Margen de Beneficio (%)', metrics.profitMargin.toFixed(2)],
      ['Costo Promedio/Servicio', metrics.averageCostPerService],
      ['Ratio Costo/Ingreso (%)', metrics.costRevenueRatio],
      ['Valor Promedio', metrics.averageServiceValue],
      ['Facturas Pendientes', metrics.pendingInvoices],
    ];
    const resumen_ws = XLSX.utils.aoa_to_sheet(resumen_ws_data);
    XLSX.utils.book_append_sheet(wb, resumen_ws, 'Resumen');

    // Add additional sheets
    if(metrics.servicesByMonth.length > 0) {
      const services_month_ws = XLSX.utils.json_to_sheet(metrics.servicesByMonth);
      XLSX.utils.book_append_sheet(wb, services_month_ws, 'Servicios por Mes');
    }

    if(metrics.costsByMonth.length > 0) {
      const costs_month_ws = XLSX.utils.json_to_sheet(metrics.costsByMonth.map(c => ({ 
        'Mes': formatDate(new Date(c.month + '-02T00:00:00'), "MMM yyyy", { locale: es }), 
        'Costo Total': c.total 
      })));
      XLSX.utils.book_append_sheet(wb, costs_month_ws, 'Costos por Mes');
    }

    if(metrics.costsByCategory.length > 0) {
      const costs_category_ws = XLSX.utils.json_to_sheet(metrics.costsByCategory.map(c => ({ 'Categoría': c.categoryName, 'Total': c.total, 'Porcentaje (%)': c.percentage })));
      XLSX.utils.book_append_sheet(wb, costs_category_ws, 'Costos por Categoría');
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
