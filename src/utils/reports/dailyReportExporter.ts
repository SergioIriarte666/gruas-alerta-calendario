import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatForDisplayShort } from '@/utils/timezoneUtils';
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

    // Calcular alertas de proveedores para el resumen
    const supplierPaymentsData = data.financial.supplierPayments || {};
    const urgentPayments = (supplierPaymentsData.overdue || []).length + (supplierPaymentsData.dueToday || []).length;
    const urgentAmount = (supplierPaymentsData.overdue || []).reduce((sum, p) => sum + (p.amount || 0), 0) + 
                        (supplierPaymentsData.dueToday || []).reduce((sum, p) => sum + (p.amount || 0), 0);

    const summaryData = [
      ['Tareas del Día', data.summary.totalTasks.toString()],
      ['Servicios Completados Hoy', data.summary.completedToday?.toString() || '0'],
      ['Eficiencia Operacional', `${data.summary.completionRate.toFixed(1)}%`],
      ['Alertas Críticas', data.summary.urgentAlerts?.toString() || '0'],
      ['Pagos Urgentes Proveedores', urgentPayments.toString()],
      ['Monto Pagos Urgentes', `$${urgentAmount.toLocaleString()}`],
      ['Ingresos Potenciales', `$${(data.services.completed?.reduce((sum, s) => sum + (s.value || 0), 0) || 0).toLocaleString()}`]
    ];

    autoTable(doc, {
      body: summaryData,
      startY: startY,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [0, 150, 136] }
    });

    let lastY = (doc as any).lastAutoTable.finalY + 15;

    // Sección de Servicios Detallada
    doc.setFontSize(14);
    doc.setTextColor(0, 150, 136);
    doc.text('ACTIVIDAD DE SERVICIOS', 14, lastY);
    lastY += 10;

    const servicesData = [
      ['Servicios Completados Hoy', data.services.completed?.length || 0],
      ['Servicios Programados Hoy', data.services.scheduled.length],
      ['Servicios en Proceso de Facturación', data.services.overdue.length],
      ['Servicios Próxima Semana', data.services.nextWeek.length],
      ['Total Servicios Activos', data.services.total]
    ];

    autoTable(doc, {
      body: servicesData,
      startY: lastY,
      theme: 'striped',
      styles: { fontSize: 9 }
    });

    lastY = (doc as any).lastAutoTable.finalY + 10;

    // Detalle de servicios completados hoy
    if (data.services.completed && data.services.completed.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(0, 100, 0);
      doc.text('SERVICIOS COMPLETADOS HOY', 14, lastY);
      lastY += 8;

      const completedData = data.services.completed.slice(0, 5).map(service => [
        service.folio || 'N/A',
        service.client?.name || 'Cliente',
        service.service_type?.name || 'Servicio',
        `$${(service.value || 0).toLocaleString()}`
      ]);

      autoTable(doc, {
        head: [['Folio', 'Cliente', 'Tipo', 'Valor']],
        body: completedData,
        startY: lastY,
        theme: 'grid',
        styles: { fontSize: 8 }
      });

      lastY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Detalle de servicios en proceso de facturación
    if (data.services.overdue && data.services.overdue.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(255, 140, 0);
      doc.text('SERVICIOS EN PROCESO DE FACTURACIÓN', 14, lastY);
      lastY += 8;

      const overdueData = data.services.overdue.slice(0, 20).map(service => [
        service.folio || 'N/A',
        service.client?.name || 'Cliente',
        service.service_type?.name || 'Servicio',
        `$${(service.value || 0).toLocaleString()}`
      ]);

      autoTable(doc, {
        head: [['Folio', 'Cliente', 'Tipo', 'Valor']],
        body: overdueData,
        startY: lastY,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [255, 140, 0] }
      });

      lastY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Sección de Agenda
    const hasEvents = data.calendar.events.length > 0 || data.calendar.weekEvents.length > 0;
    
    if (hasEvents) {
      doc.setFontSize(14);
      doc.setTextColor(0, 150, 136);
      doc.text('AGENDA', 14, lastY);
      lastY += 10;

      // Eventos del día
      if (data.calendar.events.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(0, 100, 100);
        doc.text('Eventos del Día', 14, lastY);
        lastY += 8;

        const eventsData = data.calendar.events.map(event => [
          event.title,
          event.start_time || 'Sin hora',
          event.type === 'maintenance' ? 'Mantención' : 
          event.type === 'service' ? 'Inspección' : 
          event.type === 'meeting' ? 'Reunión' : 'Otro',
          event.client?.name || event.operator?.name || 'N/A'
        ]);

        autoTable(doc, {
          head: [['Evento', 'Hora', 'Tipo', 'Responsable']],
          body: eventsData,
          startY: lastY,
          theme: 'grid',
          styles: { fontSize: 9 }
        });

        lastY = (doc as any).lastAutoTable.finalY + 8;
      }

      // Eventos de la semana
      if (data.calendar.weekEvents.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(0, 100, 100);
        doc.text('Eventos de la Semana', 14, lastY);
        lastY += 8;

        const weekEventsData = data.calendar.weekEvents.map(event => [
          event.title,
          formatForDisplayShort(event.date),
          event.start_time || 'Sin hora',
          event.type === 'maintenance' ? 'Mantención' : 
          event.type === 'service' ? 'Inspección' : 
          event.type === 'meeting' ? 'Reunión' : 'Otro',
          event.client?.name || event.operator?.name || 'N/A'
        ]);

        autoTable(doc, {
          head: [['Evento', 'Fecha', 'Hora', 'Tipo', 'Responsable']],
          body: weekEventsData,
          startY: lastY,
          theme: 'grid',
          styles: { fontSize: 9 }
        });

        lastY = (doc as any).lastAutoTable.finalY + 10;
      }
    } else {
      doc.setFontSize(14);
      doc.setTextColor(0, 150, 136);
      doc.text('AGENDA', 14, lastY);
      lastY += 10;
      
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text('No hay eventos programados', 14, lastY);
      lastY += 15;
    }

    // Sección Financiera Mejorada
    // Verificar si necesita nueva página
    if (lastY > 220) {
      doc.addPage();
      lastY = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(0, 150, 136);
    doc.text('SITUACIÓN FINANCIERA', 14, lastY);
    lastY += 10;

    // Métricas de proveedores
    const supplierPaymentsFinancial = data.financial.supplierPayments || {};
    const overduePayments = supplierPaymentsFinancial.overdue || [];
    const todayPayments = supplierPaymentsFinancial.dueToday || [];
    const weekPayments = supplierPaymentsFinancial.dueThisWeek || [];
    
    const overdueAmount = overduePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const todayAmount = todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const weekAmount = weekPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const financialData = [
      ['FACTURAS Y COBRANZAS', ''],
      ['Facturas Vencen Hoy', data.financial.invoicesDue.length.toString()],
      ['Monto Vence Hoy', `$${data.financial.totalDue.toLocaleString()}`],
      ['Facturas Vencidas', data.financial.invoicesOverdue.length.toString()],
      ['Monto Vencido', `$${data.financial.totalOverdue.toLocaleString()}`],
      ['', ''],
      ['PAGOS A PROVEEDORES', ''],
      ['Pagos Vencidos', overduePayments.length.toString()],
      ['Monto Vencido Proveedores', `$${overdueAmount.toLocaleString()}`],
      ['Pagos Vencen Hoy', todayPayments.length.toString()],
      ['Monto Vence Hoy Proveedores', `$${todayAmount.toLocaleString()}`],
      ['Pagos Vencen Esta Semana', weekPayments.length.toString()],
      ['Monto Semana Proveedores', `$${weekAmount.toLocaleString()}`],
      ['', ''],
      ['OTROS', ''],
      ['Servicios por Facturar', data.financial.invoicesToIssue.length.toString()]
    ];

    autoTable(doc, {
      body: financialData,
      startY: lastY,
      theme: 'striped',
      styles: { fontSize: 9 },
      columnStyles: {
        1: { halign: 'right' }
      }
    });

    lastY = (doc as any).lastAutoTable.finalY + 15;

    // Nueva Sección Detallada de Pagos a Proveedores
    const allUpcomingPayments = [
      ...(overduePayments || []).map(p => ({ ...p, urgency: 'high', status: 'Vencido' })),
      ...(todayPayments || []).map(p => ({ ...p, urgency: 'high', status: 'Vence Hoy' })),
      ...(weekPayments || []).map(p => ({ ...p, urgency: 'medium', status: 'Esta Semana' }))
    ].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    if (allUpcomingPayments.length > 0) {
      // Verificar si necesita nueva página
      if (lastY > 200) {
        doc.addPage();
        lastY = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(220, 53, 69);
      doc.text('PAGOS A PROVEEDORES - VENCIMIENTOS PRÓXIMOS', 14, lastY);
      lastY += 10;

      const paymentsData = allUpcomingPayments.slice(0, 15).map(payment => [
        payment.supplier?.name || 'Proveedor',
        payment.description || 'Concepto',
        `$${(payment.amount || 0).toLocaleString()}`,
        formatDate(new Date(payment.due_date), 'dd/MM/yyyy', { locale: es }),
        payment.status
      ]);

      autoTable(doc, {
        head: [['Proveedor', 'Concepto', 'Monto', 'Vencimiento', 'Estado']],
        body: paymentsData,
        startY: lastY,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 53, 69] },
        columnStyles: {
          2: { halign: 'right' }, // Monto alineado a la derecha
          3: { halign: 'center' }, // Fecha centrada
          4: { halign: 'center' } // Estado centrado
        }
      });

      lastY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Sección de Operaciones Mejorada
    doc.setFontSize(14);
    doc.setTextColor(0, 150, 136);
    doc.text('ESTADO OPERACIONAL', 14, lastY);
    lastY += 10;

    // Resumen operacional
    const operationalData = [
      ['Grúas Activas', data.operations.cranes.active.toString()],
      ['Grúas en Mantención', data.operations.cranes.maintenance.toString()],
      ['Operadores Asignados', data.operations.operators.assigned.toString()],
      ['Operadores Disponibles', data.operations.operators.available.toString()]
    ];

    autoTable(doc, {
      body: operationalData,
      startY: lastY,
      theme: 'striped',
      styles: { fontSize: 9 }
    });

    lastY = (doc as any).lastAutoTable.finalY + 15;

    // Alertas de documentos con más detalle
    if (data.operations.documentAlerts.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(220, 53, 69);
      doc.text('ALERTAS DE DOCUMENTOS', 14, lastY);
      lastY += 8;

      const alertsData = data.operations.documentAlerts.slice(0, 10).map(alert => [
        alert.type || 'Documento',
        alert.crane || 'N/A',
        alert.licensePlate || 'N/A',
        alert.description || 'Sin descripción',
        alert.priority || 'Normal'
      ]);

      autoTable(doc, {
        head: [['Documento', 'Grúa', 'Patente', 'Estado', 'Urgencia']],
        body: alertsData,
        startY: lastY,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 53, 69] }
      });

      lastY = (doc as any).lastAutoTable.finalY + 10;
    } else {
      doc.setFontSize(10);
      doc.setTextColor(40, 167, 69);
      doc.text('✓ Todos los documentos están al día', 14, lastY);
      lastY += 15;
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generado el ${formatDate(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`, 14, doc.internal.pageSize.height - 10);

    doc.save(`${exportFileDefaultName}.pdf`);

  } else if (format === 'excel') {
    const XLSX = await import('xlsx');
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
      ['Servicios en proceso de facturación', data.services.overdue.length],
      ['Total de Servicios', data.services.total]
    ];
    const summary_ws = XLSX.utils.aoa_to_sheet(summary_ws_data);
    XLSX.utils.book_append_sheet(wb, summary_ws, 'Resumen');

    // Hoja 2: Agenda (Eventos del Día y de la Semana)
    const hasEvents = data.calendar.events.length > 0 || data.calendar.weekEvents.length > 0;
    
    if (hasEvents) {
      const agenda_data = [];
      
      // Agregar eventos del día
      if (data.calendar.events.length > 0) {
        agenda_data.push(['EVENTOS DEL DÍA', '', '', '', '']);
        data.calendar.events.forEach(event => {
          agenda_data.push([
            event.title,
            'HOY',
            event.start_time || 'Sin hora',
            event.description || 'Sin descripción',
            event.location || 'Sin ubicación'
          ]);
        });
        agenda_data.push(['', '', '', '', '']); // Separador
      }
      
      // Agregar eventos de la semana
      if (data.calendar.weekEvents.length > 0) {
        agenda_data.push(['EVENTOS DE LA SEMANA', '', '', '', '']);
        data.calendar.weekEvents.forEach(event => {
          agenda_data.push([
            event.title,
            formatForDisplayShort(event.date),
            event.start_time || 'Sin hora',
            event.description || 'Sin descripción',
            event.location || 'Sin ubicación'
          ]);
        });
      }
      
      const agenda_ws = XLSX.utils.aoa_to_sheet([
        ['Evento', 'Fecha', 'Hora', 'Descripción', 'Ubicación'],
        ...agenda_data
      ]);
      XLSX.utils.book_append_sheet(wb, agenda_ws, 'Agenda');
    }

    // Hoja 3: Estado Financiero - Facturas
    if (data.financial.invoicesDue.length > 0) {
      const financial_data = [
        ['FACTURAS POR VENCER', '', '', ''],
        ['Cliente', 'Número', 'Monto', 'Vencimiento'],
        ...data.financial.invoicesDue.map(invoice => [
          invoice.clientName || 'Cliente',
          invoice.number || 'N/A',
          invoice.amount || 0,
          invoice.dueDate || 'Sin fecha'
        ])
      ];
      const financial_ws = XLSX.utils.aoa_to_sheet(financial_data);
      XLSX.utils.book_append_sheet(wb, financial_ws, 'Financiero');
    }

    // Hoja 4: Proveedores - Detalle Completo
    const supplierPaymentsExcel = data.financial.supplierPayments || {};
    const allSupplierPayments = [
      ...(supplierPaymentsExcel.overdue || []).map(p => ({ ...p, status_label: 'Vencido', urgency: 'Alta' })),
      ...(supplierPaymentsExcel.dueToday || []).map(p => ({ ...p, status_label: 'Vence Hoy', urgency: 'Alta' })),
      ...(supplierPaymentsExcel.dueThisWeek || []).map(p => ({ ...p, status_label: 'Esta Semana', urgency: 'Media' }))
    ];

    if (allSupplierPayments.length > 0) {
      const suppliers_data = [
        ['PAGOS A PROVEEDORES', '', '', '', '', ''],
        ['Proveedor', 'RUT', 'Concepto', 'Monto', 'Vencimiento', 'Estado', 'Urgencia'],
        ...allSupplierPayments.map(payment => [
          payment.supplier?.name || 'Proveedor',
          payment.supplier?.rut || 'N/A',
          payment.description || 'Concepto',
          payment.amount || 0,
          formatDate(new Date(payment.due_date), 'dd/MM/yyyy', { locale: es }),
          payment.status_label,
          payment.urgency
        ])
      ];
      const suppliers_ws = XLSX.utils.aoa_to_sheet(suppliers_data);
      XLSX.utils.book_append_sheet(wb, suppliers_ws, 'Proveedores');
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
