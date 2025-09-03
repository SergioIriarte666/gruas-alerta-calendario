import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExportDailyReportArgs } from './reportTypes';
import { createExportFileName, addCompanyHeader } from './reportUtils';

export const exportDailyReport = async ({ format, data, settings, appliedFilters }: ExportDailyReportArgs) => {
  const { company } = settings;
  const selectedDate = appliedFilters.selectedDate;
  const exportFileDefaultName = createExportFileName('informe-diario', selectedDate, selectedDate);

  if (format === 'pdf') {
    const doc = new jsPDF();
    let startY = await addCompanyHeader(doc, company, 15);

    // Título del reporte
    doc.setFontSize(16);
    doc.setTextColor(0, 150, 136);
    doc.text('INFORME DIARIO', 14, startY);
    startY += 8;

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Fecha: ${formatDate(new Date(selectedDate + 'T00:00:00'), 'EEEE, dd MMMM yyyy', { locale: es })}`, 14, startY);
    startY += 15;

    // Resumen Ejecutivo
    doc.setFontSize(14);
    doc.setTextColor(0, 150, 136);
    doc.text('RESUMEN EJECUTIVO', 14, startY);
    startY += 10;

    const summaryData = [
      ['Total de Tareas', data.summary.totalTasks.toString()],
      ['Tareas Críticas', data.summary.criticalTasks.toString()],
      ['% Completitud', `${data.summary.completionRate.toFixed(1)}%`],
      ['Alertas Activas', data.summary.alerts.toString()]
    ];

    autoTable(doc, {
      body: summaryData,
      startY: startY,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [0, 150, 136] }
    });

    let lastY = (doc as any).lastAutoTable.finalY + 15;

    // Sección de Servicios
    if (data.services.scheduled.length > 0 || data.services.pending.length > 0 || data.services.overdue.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(0, 150, 136);
      doc.text('SERVICIOS', 14, lastY);
      lastY += 10;

      const servicesData = [
        ['Servicios Programados', data.services.scheduled.length.toString()],
        ['Servicios Pendientes', data.services.pending.length.toString()],
        ['Servicios Atrasados', data.services.overdue.length.toString()],
        ['Total de Servicios', data.services.total.toString()]
      ];

      autoTable(doc, {
        body: servicesData,
        startY: lastY,
        theme: 'striped',
        styles: { fontSize: 9 }
      });

      lastY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Sección de Agenda
    if (data.calendar.events.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(0, 150, 136);
      doc.text('AGENDA DEL DÍA', 14, lastY);
      lastY += 10;

      const eventsData = data.calendar.events.map(event => [
        event.title,
        event.startTime || 'Sin hora',
        event.description || 'Sin descripción'
      ]);

      autoTable(doc, {
        head: [['Evento', 'Hora', 'Descripción']],
        body: eventsData,
        startY: lastY,
        theme: 'grid',
        styles: { fontSize: 9 }
      });

      lastY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Sección Financiera
    if (data.financial.invoicesDue.length > 0 || data.financial.paymentsToMake.length > 0) {
      // Verificar si necesita nueva página
      if (lastY > 220) {
        doc.addPage();
        lastY = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(0, 150, 136);
      doc.text('ESTADO FINANCIERO', 14, lastY);
      lastY += 10;

      const financialData = [
        ['Facturas por Vencer', data.financial.invoicesDue.length.toString()],
        ['Pagos Programados', data.financial.paymentsToMake.length.toString()],
        ['Total Compromisos Financieros', (data.financial.invoicesDue.length + data.financial.paymentsToMake.length).toString()]
      ];

      autoTable(doc, {
        body: financialData,
        startY: lastY,
        theme: 'striped',
        styles: { fontSize: 9 }
      });

      lastY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Sección de Operaciones
    if (data.operations.documentAlerts.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(0, 150, 136);
      doc.text('ALERTAS OPERACIONALES', 14, lastY);
      lastY += 10;

      const alertsData = data.operations.documentAlerts.map(alert => [
        alert.type || 'Alerta',
        alert.message || 'Sin descripción',
        alert.priority || 'Normal'
      ]);

      autoTable(doc, {
        head: [['Tipo', 'Descripción', 'Prioridad']],
        body: alertsData,
        startY: lastY,
        theme: 'grid',
        styles: { fontSize: 9 }
      });

      lastY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generado el ${formatDate(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`, 14, doc.internal.pageSize.height - 10);

    doc.save(`${exportFileDefaultName}.pdf`);

  } else if (format === 'excel') {
    const wb = XLSX.utils.book_new();

    // Hoja 1: Resumen Ejecutivo
    const summary_ws_data = [
      [company.name],
      [`RUT: ${company.taxId}`],
      [company.address],
      [`Tel: ${company.phone} | Email: ${company.email}`],
      [],
      ['INFORME DIARIO'],
      [`Fecha: ${formatDate(new Date(selectedDate + 'T00:00:00'), 'EEEE, dd MMMM yyyy', { locale: es })}`],
      [],
      ['RESUMEN EJECUTIVO'],
      ['Métrica', 'Valor'],
      ['Total de Tareas', data.summary.totalTasks],
      ['Tareas Críticas', data.summary.criticalTasks],
      ['% Completitud', `${data.summary.completionRate.toFixed(1)}%`],
      ['Alertas Activas', data.summary.alerts],
      [],
      ['SERVICIOS'],
      ['Tipo', 'Cantidad'],
      ['Servicios Programados', data.services.scheduled.length],
      ['Servicios Pendientes', data.services.pending.length],
      ['Servicios Atrasados', data.services.overdue.length],
      ['Total de Servicios', data.services.total]
    ];
    const summary_ws = XLSX.utils.aoa_to_sheet(summary_ws_data);
    XLSX.utils.book_append_sheet(wb, summary_ws, 'Resumen');

    // Hoja 2: Agenda del Día
    if (data.calendar.events.length > 0) {
      const events_data = data.calendar.events.map(event => ({
        'Evento': event.title,
        'Hora': event.startTime || 'Sin hora',
        'Descripción': event.description || 'Sin descripción',
        'Ubicación': event.location || 'Sin ubicación'
      }));
      const events_ws = XLSX.utils.json_to_sheet(events_data);
      XLSX.utils.book_append_sheet(wb, events_ws, 'Agenda');
    }

    // Hoja 3: Estado Financiero
    if (data.financial.invoicesDue.length > 0 || data.financial.paymentsToMake.length > 0) {
      const financial_data = [
        ['FACTURAS POR VENCER', '', '', ''],
        ['Cliente', 'Número', 'Monto', 'Vencimiento'],
        ...data.financial.invoicesDue.map(invoice => [
          invoice.clientName || 'Cliente',
          invoice.number || 'N/A',
          invoice.amount || 0,
          invoice.dueDate || 'Sin fecha'
        ]),
        [],
        ['PAGOS PROGRAMADOS', '', '', ''],
        ['Proveedor', 'Concepto', 'Monto', 'Fecha'],
        ...data.financial.paymentsToMake.map(payment => [
          payment.supplierName || 'Proveedor',
          payment.concept || 'Pago',
          payment.amount || 0,
          payment.dueDate || 'Sin fecha'
        ])
      ];
      const financial_ws = XLSX.utils.aoa_to_sheet(financial_data);
      XLSX.utils.book_append_sheet(wb, financial_ws, 'Financiero');
    }

    // Hoja 4: Alertas Operacionales
    if (data.operations.documentAlerts.length > 0) {
      const alerts_data = data.operations.documentAlerts.map(alert => ({
        'Tipo': alert.type || 'Alerta',
        'Descripción': alert.message || 'Sin descripción',
        'Prioridad': alert.priority || 'Normal',
        'Fecha': alert.date || 'Sin fecha'
      }));
      const alerts_ws = XLSX.utils.json_to_sheet(alerts_data);
      XLSX.utils.book_append_sheet(wb, alerts_ws, 'Alertas');
    }

    XLSX.writeFile(wb, `${exportFileDefaultName}.xlsx`);
  }
};