import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { businessClock } from '@/utils/businessClock';
import { ExportCostReportArgs } from './reportTypes';
import {
  createExportFileName,
  addCompanyHeader,
  addStandardReportFooter,
  REPORT_PDF_COLORS,
} from './reportUtils';

export const exportCostReport = async ({ format, costs, settings, appliedFilters, headerCompany, headerLogoUrl, serviceDetails = [] }: ExportCostReportArgs) => {
  const company = headerCompany || settings.company;
  const exportFileDefaultName = createExportFileName('informe-costos', appliedFilters.dateRange.from, appliedFilters.dateRange.to);
  
  const totalCosts = costs.reduce((acc, cost) => acc + (Number(cost.amount) || 0), 0);

  if (format === 'pdf') {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    let startY = await addCompanyHeader(doc, company, 15, headerLogoUrl);

    doc.setFontSize(14);
    doc.text('Informe Detallado de Costos', 14, startY);
    startY += 10;
    
    // Filtros aplicados
    const filterLabels = [
      ['Período', `${businessClock.format(appliedFilters.dateRange.from, 'P')} - ${businessClock.format(appliedFilters.dateRange.to, 'P')}`],
      ['Empresa', appliedFilters.companyName || 'Todas las empresas'],
      ['Categoría', appliedFilters.categoryName || 'Todas las categorías'],
      ['Grúa', appliedFilters.craneName || 'Todas las grúas'],
      ['Operador', appliedFilters.operatorName || 'Todos los operadores']
    ];
    doc.setFontSize(11);
    autoTable(doc, { body: filterLabels, startY, theme: 'plain', styles: { fontSize: 9 } });

    let lastY = (doc as any).lastAutoTable.finalY;

    // Resumen ejecutivo
    const summaryData = [
      ['Total Costos', costs.length.toString()],
      ['Monto Total', `$${totalCosts.toLocaleString('es-CL')}`],
      ['Costo Promedio', costs.length > 0 ? `$${(totalCosts / costs.length).toLocaleString('es-CL')}` : '$0']
    ];
    doc.setFontSize(11);
    autoTable(doc, { head: [['Resumen Ejecutivo', '']], body: summaryData, startY: lastY + 5, theme: 'grid' });
    lastY = (doc as any).lastAutoTable.finalY;

    // Tabla detallada de costos
    const availableWidth = pageWidth - 28;
    autoTable(doc, {
      head: [['Fecha', 'Descripción', 'Categoría', 'Monto', 'Asociado a', 'Notas']],
      body: costs.map(cost => [
        businessClock.format(cost.date, 'dd/MM/yy'),
        cost.description.length > 20 ? cost.description.substring(0, 20) + '...' : cost.description,
        cost.subcategory && cost.cost_categories.name === 'Gastos de Servicios' 
          ? `${cost.cost_categories.name} - ${cost.subcategory}` 
          : cost.cost_categories.name,
        `$${Number(cost.amount).toLocaleString('es-CL')}`,
        getAssociatedTo(cost),
        cost.notes ? (cost.notes.length > 15 ? cost.notes.substring(0, 15) + '...' : cost.notes) : ''
      ]),
      startY: lastY + 10,
      headStyles: { fillColor: REPORT_PDF_COLORS.primary, fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 1.5 },
      tableWidth: availableWidth,
      columnStyles: {
        0: { cellWidth: availableWidth * 0.10 }, // Fecha - 10%
        1: { cellWidth: availableWidth * 0.25 }, // Descripción - 25%
        2: { cellWidth: availableWidth * 0.15 }, // Categoría - 15%
        3: { cellWidth: availableWidth * 0.12 }, // Monto - 12%
        4: { cellWidth: availableWidth * 0.23 }, // Asociado a - 23%
        5: { cellWidth: availableWidth * 0.15 }  // Notas - 15%
      }
    });

    if (serviceDetails.length > 0) {
      doc.addPage('a4', 'landscape');
      doc.setFontSize(12);
      doc.text('Detalle de Servicios del Período', 14, 16);
      autoTable(doc, {
        head: [['Fecha', 'Folio', 'Cliente', 'Tipo', 'Operador', 'Grúa', 'Origen', 'Destino', 'Estado', 'Valor']],
        body: serviceDetails.map(service => [
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
        ]),
        startY: 22,
        headStyles: { fillColor: REPORT_PDF_COLORS.primary, fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 1.2 },
      });
    }
    
    addStandardReportFooter(doc);
    doc.save(`${exportFileDefaultName}.pdf`);

  } else if (format === 'excel') {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Hoja principal: Detalle completo de costos
    const costs_data = costs.map(cost => ({
      'Fecha': businessClock.format(cost.date, 'yyyy-MM-dd'),
      'Descripción': cost.description,
      'Categoría': cost.subcategory && cost.cost_categories.name === 'Gastos de Servicios' 
        ? `${cost.cost_categories.name} - ${cost.subcategory}` 
        : cost.cost_categories.name,
      'Monto': Number(cost.amount),
      'Grúa': cost.cranes ? `${cost.cranes.brand} ${cost.cranes.model} (${cost.cranes.license_plate})` : '',
      'Operador': cost.operators ? cost.operators.name : '',
      'Servicio Folio': cost.services ? cost.services.folio : '',
      'Cliente': cost.services?.clients ? cost.services.clients.name : '',
      'Notas': cost.notes || '',
    }));
    const costs_ws = XLSX.utils.json_to_sheet(costs_data);
    XLSX.utils.book_append_sheet(wb, costs_ws, 'Detalle de Costos');

    // Hoja de resumen por categoría
    const categorySummary = costs.reduce((acc, cost) => {
      const category = cost.cost_categories.name;
      if (!acc[category]) {
        acc[category] = { count: 0, total: 0 };
      }
      acc[category].count++;
      acc[category].total += Number(cost.amount);
      return acc;
    }, {} as Record<string, { count: number; total: number }>);

    const category_data = Object.entries(categorySummary).map(([category, data]) => ({
      'Categoría': category,
      'Cantidad': data.count,
      'Total': data.total,
      'Promedio': data.total / data.count
    }));
    const category_ws = XLSX.utils.json_to_sheet(category_data);
    XLSX.utils.book_append_sheet(wb, category_ws, 'Resumen por Categoría');

    // Hoja de tendencia mensual
    const monthlyTrend = costs.reduce((acc, cost) => {
      const month = businessClock.format(cost.date, 'yyyy-MM');
      if (!acc[month]) {
        acc[month] = { count: 0, total: 0 };
      }
      acc[month].count++;
      acc[month].total += Number(cost.amount);
      return acc;
    }, {} as Record<string, { count: number; total: number }>);

    const trend_data = Object.entries(monthlyTrend)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        'Mes': month,
        'Cantidad': data.count,
        'Total': data.total,
        'Promedio': data.total / data.count
      }));
    const trend_ws = XLSX.utils.json_to_sheet(trend_data);
    XLSX.utils.book_append_sheet(wb, trend_ws, 'Tendencia Mensual');

    // Hoja resumen ejecutivo
    const summary_ws_data = [
      [company.name],
      ['Informe Detallado de Costos'], [],
      ['Filtros Aplicados'],
      ['Período', `${businessClock.format(appliedFilters.dateRange.from, 'P')} a ${businessClock.format(appliedFilters.dateRange.to, 'P')}`],
      ['Categoría', appliedFilters.categoryName || 'Todas las categorías'],
      ['Grúa', appliedFilters.craneName || 'Todas las grúas'],
      ['Operador', appliedFilters.operatorName || 'Todos los operadores'], [],
      ['Resumen Ejecutivo'],
      ['Métrica', 'Valor'],
      ['Total Costos', costs.length],
      ['Monto Total', totalCosts],
      ['Costo Promedio', costs.length > 0 ? totalCosts / costs.length : 0],
    ];
    const summary_ws = XLSX.utils.aoa_to_sheet(summary_ws_data);
    XLSX.utils.book_append_sheet(wb, summary_ws, 'Resumen Ejecutivo');

    if (serviceDetails.length > 0) {
      const services_ws = XLSX.utils.json_to_sheet(serviceDetails.map(service => ({
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
      XLSX.utils.book_append_sheet(wb, services_ws, 'Detalle Servicios');
    }

    XLSX.writeFile(wb, `${exportFileDefaultName}.xlsx`);
  }
};

const getAssociatedTo = (cost: any) => {
  if (cost.cranes) return `Grúa: ${cost.cranes.brand} ${cost.cranes.model}`;
  if (cost.operators) return `Operador: ${cost.operators.name}`;
  if (cost.services) return `Servicio: ${cost.services.folio}`;
  return 'General';
};
