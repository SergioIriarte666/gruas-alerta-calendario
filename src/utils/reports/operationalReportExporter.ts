
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { businessClock } from '@/utils/businessClock';
import { ExportReportArgs } from './reportTypes';
import {
  createExportFileName,
  addCompanyHeader,
  addStandardReportFooter,
  REPORT_PDF_COLORS,
} from './reportUtils';

export const exportOperationalReport = async ({ format, metrics, settings, appliedFilters, filterLabels }: ExportReportArgs) => {
  const { company } = settings;
  const exportFileDefaultName = createExportFileName('reporte', appliedFilters.dateRange.from, appliedFilters.dateRange.to);
  const serviceDetailHeaders = ['Fecha', 'Folio', 'Cliente', 'Tipo', 'Operador', 'Grúa', 'Origen', 'Destino', 'Estado', 'Valor'];

  if (format === 'pdf') {
    const doc = new jsPDF();
    const startY = await addCompanyHeader(doc, company, 15);

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
        head: [['#', 'Cliente — Depto.', 'Servicios', 'Ingresos']],
        body: metrics.topClients.map((c, i) => [i + 1, `${c.clientName}${c.department ? ' — ' + c.department : ''}`, c.services, `$${c.revenue.toLocaleString()}`]),
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
        body: metrics.costsByMonth.map(c => [businessClock.format(`${c.month}-02`, "MMM yyyy"), `$${c.total.toLocaleString()}`]),
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

    if (metrics.serviceDetails.length > 0) {
      doc.addPage('a4', 'landscape');
      doc.setFontSize(12);
      doc.text('Detalle de Servicios', 14, 16);
      autoTable(doc, {
        head: [serviceDetailHeaders],
        body: metrics.serviceDetails.map(service => ([
          businessClock.format(service.serviceDate, 'dd/MM/yyyy'),
          service.folio,
          service.clientName,
          service.serviceTypeName,
          service.operatorName,
          service.craneName,
          service.origin,
          service.destination,
          service.status,
          `$${service.value.toLocaleString('es-CL')}`,
        ])),
        startY: 22,
        headStyles: { fillColor: REPORT_PDF_COLORS.primary, fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 1.2 },
      });
    }

    addStandardReportFooter(doc);
    doc.save(`${exportFileDefaultName}.pdf`);

  } else if (format === 'excel') {
    const wb = XLSX.utils.book_new();

    const resumen_ws_data = [
      [company.name],
      [`RUT: ${company.taxId}`],
      [company.address],
      [`Tel: ${company.phone} | Email: ${company.email}`],
      [],
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
      const services_month_ws = XLSX.utils.json_to_sheet(metrics.servicesByMonth.map(s => ({
        'Mes': businessClock.format(`${s.month}-02`, "MMM yyyy"),
        'Servicios': s.services,
        'Ingresos': s.revenue
      })));
      XLSX.utils.book_append_sheet(wb, services_month_ws, 'Servicios por Mes');
    }

    if(metrics.costsByMonth.length > 0) {
      const costs_month_ws = XLSX.utils.json_to_sheet(metrics.costsByMonth.map(c => ({
        'Mes': businessClock.format(`${c.month}-02`, "MMM yyyy"),
        'Costo Total': c.total
      })));
      XLSX.utils.book_append_sheet(wb, costs_month_ws, 'Costos por Mes');
    }

    if(metrics.costsByCategory.length > 0) {
      const costs_category_ws = XLSX.utils.json_to_sheet(metrics.costsByCategory.map(c => ({ 'Categoría': c.categoryName, 'Total': c.total, 'Porcentaje (%)': c.percentage })));
      XLSX.utils.book_append_sheet(wb, costs_category_ws, 'Costos por Categoría');
    }

    if(metrics.topClients.length > 0) {
      const top_clients_ws = XLSX.utils.json_to_sheet(metrics.topClients.map(c => ({ 'Cliente — Depto.': `${c.clientName}${c.department ? ' — ' + c.department : ''}`, 'Servicios': c.services, 'Ingresos': c.revenue })));
      XLSX.utils.book_append_sheet(wb, top_clients_ws, 'Top Clientes');
    }

    if(metrics.craneUtilization.length > 0) {
      const crane_util_ws = XLSX.utils.json_to_sheet(metrics.craneUtilization.map(c => ({ 'Grúa': c.craneName, 'Servicios': c.services, 'Utilización (%)': c.utilization })));
      XLSX.utils.book_append_sheet(wb, crane_util_ws, 'Utilización Grúas');
    }

    if(metrics.servicesByStatus.length > 0) {
      const statusLabels: Record<string, string> = {
        completed: 'Completado', pending: 'Pendiente', cancelled: 'Cancelado',
        in_progress: 'En Progreso', assigned: 'Asignado', invoiced: 'Facturado',
        quoted: 'Cotizado', purchase_order_pending: 'Esperando O.C.',
        with_purchase_order: 'Con Orden de Compra', failed: 'Fallido',
        inspection_completed: 'Inspección Completada',
        partially_invoiced: 'Parcialmente Facturado', written_off: 'Castigado'
      };
      const services_status_ws = XLSX.utils.json_to_sheet(metrics.servicesByStatus.map(s => ({
        'Estado': statusLabels[s.status] || s.status,
        'Cantidad': s.count,
        'Porcentaje (%)': Number(s.percentage.toFixed(1))
      })));
      XLSX.utils.book_append_sheet(wb, services_status_ws, 'Servicios por Estado');
    }

    if (metrics.serviceDetails.length > 0) {
      const service_detail_ws = XLSX.utils.json_to_sheet(metrics.serviceDetails.map(service => ({
        'Fecha': businessClock.format(service.serviceDate, 'yyyy-MM-dd'),
        'Folio': service.folio,
        'Cliente': service.clientName,
        'Tipo de Servicio': service.serviceTypeName,
        'Operador': service.operatorName,
        'Grúa': service.craneName,
        'Origen': service.origin,
        'Destino': service.destination,
        'Estado': service.status,
        'Valor': service.value,
      })));
      XLSX.utils.book_append_sheet(wb, service_detail_ws, 'Detalle Servicios');
    }

    XLSX.writeFile(wb, `${exportFileDefaultName}.xlsx`);
  }
};
