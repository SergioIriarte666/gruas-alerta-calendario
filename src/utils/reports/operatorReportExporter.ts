import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ExportOperatorReportArgs } from './reportTypes';
import { addCompanyHeader, createExportFileName } from './reportUtils';
import { businessClock } from '@/utils/businessClock';

const statusLabels: Record<string, string> = {
  completed: 'Completado',
  pending: 'Pendiente',
  in_progress: 'En progreso',
  cancelled: 'Cancelado',
  scheduled: 'Programado',
  assigned: 'Asignado',
  invoiced: 'Facturado',
  quoted: 'Cotizado',
  purchase_order_pending: 'Esperando O.C.',
  with_purchase_order: 'Con O.C.',
  failed: 'Fallido',
  inspection_completed: 'Inspección completada',
};

export const exportOperatorReport = async ({
  format,
  metrics,
  settings,
  appliedFilters,
}: ExportOperatorReportArgs) => {
  const { company } = settings;
  const exportFileDefaultName = createExportFileName(
    'informe-operadores',
    appliedFilters.dateRange.from,
    appliedFilters.dateRange.to,
  );

  const operatorLabel = appliedFilters.operatorName || 'Todos los operadores';
  const operatorCountInView = metrics.operatorUtilization.length;
  const averageServicesPerOperator = operatorCountInView > 0
    ? metrics.totalServices / operatorCountInView
    : 0;
  const serviceDetailHeaders = ['Fecha', 'Folio', 'Cliente', 'Tipo', 'Operador', 'Grúa', 'Origen', 'Destino', 'Estado', 'Valor'];

  if (format === 'pdf') {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    let startY = await addCompanyHeader(doc, company, 15);

    doc.setFontSize(15);
    doc.setFont(undefined, 'bold');
    doc.text('Informe de Operadores', 14, startY);
    doc.setFont(undefined, 'normal');
    startY += 10;

    autoTable(doc, {
      body: [
        ['Período', `${businessClock.format(new Date(`${appliedFilters.dateRange.from}T12:00:00Z`), 'P')} - ${businessClock.format(new Date(`${appliedFilters.dateRange.to}T12:00:00Z`), 'P')}`],
        ['Operador', operatorLabel],
      ],
      startY,
      theme: 'plain',
      styles: { fontSize: 9 },
      columnStyles: {
        0: { fontStyle: 'bold' },
      },
    });

    let lastY = (doc as any).lastAutoTable.finalY;

    autoTable(doc, {
      head: [['Resumen Ejecutivo', 'Valor']],
      body: [
        ['Operadores con actividad', metrics.operatorUtilization.length.toString()],
        ['Operadores activos', metrics.activeOperators.toString()],
        ['Total servicios', metrics.totalServices.toString()],
        ['Servicios por operador', averageServicesPerOperator.toFixed(1)],
        ['Ingresos totales', `$${metrics.totalRevenue.toLocaleString('es-CL')}`],
        ['Ticket promedio', `$${Math.round(metrics.averageServiceValue).toLocaleString('es-CL')}`],
      ],
      startY: lastY + 6,
      theme: 'grid',
      headStyles: { fillColor: [124, 58, 237] },
      styles: { fontSize: 9 },
    });

    lastY = (doc as any).lastAutoTable.finalY;

    autoTable(doc, {
      head: [['#', 'Operador', 'Servicios', 'Utilización']],
      body: metrics.operatorUtilization.map((operator, index) => ([
        index + 1,
        operator.operatorName,
        operator.services,
        `${operator.utilization.toFixed(1)}%`,
      ])),
      startY: lastY + 8,
      theme: 'striped',
      headStyles: { fillColor: [91, 33, 182] },
      styles: { fontSize: 8.5 },
    });

    lastY = (doc as any).lastAutoTable.finalY;

    if (metrics.servicesByStatus.length > 0) {
      autoTable(doc, {
        head: [['Estado', 'Cantidad', 'Porcentaje']],
        body: metrics.servicesByStatus.map(status => ([
          statusLabels[status.status] || status.status,
          status.count,
          `${status.percentage.toFixed(1)}%`,
        ])),
        startY: lastY + 8,
        theme: 'grid',
        headStyles: { fillColor: [55, 65, 81] },
        styles: { fontSize: 8.5 },
      });
      lastY = (doc as any).lastAutoTable.finalY;
    }

    if (metrics.serviceDetails.length > 0) {
      autoTable(doc, {
        head: [serviceDetailHeaders],
        body: metrics.serviceDetails.map(service => ([
          businessClock.format(new Date(`${service.serviceDate}T12:00:00Z`), 'dd/MM/yyyy'),
          service.folio,
          service.clientName,
          service.serviceTypeName,
          service.operatorName,
          service.craneName,
          service.origin,
          service.destination,
          statusLabels[service.status] || service.status,
          `$${service.value.toLocaleString('es-CL')}`,
        ])),
        startY: lastY + 8,
        theme: 'striped',
        headStyles: { fillColor: [124, 58, 237] },
        styles: { fontSize: 7.5, cellPadding: 1.2 },
      });
    }

    doc.save(`${exportFileDefaultName}.pdf`);
    return;
  }

  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const summaryWs = XLSX.utils.aoa_to_sheet([
    [company.name],
    [`RUT: ${company.taxId || 'N/A'}`],
    [company.address || ''],
    [`Tel: ${company.phone || 'N/A'} | Email: ${company.email || 'N/A'}`],
    [],
    ['Informe de Operadores'],
    [],
    ['Filtros Aplicados'],
    ['Período', `${appliedFilters.dateRange.from} a ${appliedFilters.dateRange.to}`],
    ['Operador', operatorLabel],
    [],
    ['Resumen Ejecutivo'],
    ['Métrica', 'Valor'],
    ['Operadores con actividad', metrics.operatorUtilization.length],
    ['Operadores activos', metrics.activeOperators],
    ['Total servicios', metrics.totalServices],
    ['Servicios por operador', Number(averageServicesPerOperator.toFixed(1))],
    ['Ingresos totales', metrics.totalRevenue],
    ['Ticket promedio', Math.round(metrics.averageServiceValue)],
  ]);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumen');

  const rankingWs = XLSX.utils.json_to_sheet(
    metrics.operatorUtilization.map((operator, index) => ({
      'Ranking': index + 1,
      'Operador': operator.operatorName,
      'Servicios': operator.services,
      'Utilización (%)': Number(operator.utilization.toFixed(1)),
    })),
  );
  XLSX.utils.book_append_sheet(wb, rankingWs, 'Ranking Operadores');

  const statusWs = XLSX.utils.json_to_sheet(
    metrics.servicesByStatus.map(status => ({
      'Estado': statusLabels[status.status] || status.status,
      'Cantidad': status.count,
      'Porcentaje (%)': Number(status.percentage.toFixed(1)),
    })),
  );
  XLSX.utils.book_append_sheet(wb, statusWs, 'Servicios por Estado');

  if (metrics.serviceDetails.length > 0) {
    const detailWs = XLSX.utils.json_to_sheet(
      metrics.serviceDetails.map(service => ({
        'Fecha': businessClock.format(new Date(`${service.serviceDate}T12:00:00Z`), 'yyyy-MM-dd'),
        'Folio': service.folio,
        'Cliente': service.clientName,
        'Tipo de Servicio': service.serviceTypeName,
        'Operador': service.operatorName,
        'Grúa': service.craneName,
        'Origen': service.origin,
        'Destino': service.destination,
        'Estado': statusLabels[service.status] || service.status,
        'Valor': service.value,
      })),
    );
    XLSX.utils.book_append_sheet(wb, detailWs, 'Detalle Servicios');
  }

  XLSX.writeFile(wb, `${exportFileDefaultName}.xlsx`);
};
