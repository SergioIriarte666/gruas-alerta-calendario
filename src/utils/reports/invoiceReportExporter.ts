import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExportInvoiceReportArgs } from './reportTypes';
import { createExportFileName, addCompanyHeader } from './reportUtils';

export const exportInvoiceReport = async ({ 
  format, 
  invoices, 
  settings, 
  appliedFilters,
  metrics 
}: ExportInvoiceReportArgs) => {
  const { company } = settings;
  const exportFileDefaultName = createExportFileName(
    'informe-facturas', 
    appliedFilters.dateFrom || 'inicio', 
    appliedFilters.dateTo || 'fin'
  );

  // Calcular métricas si no se proporcionaron
  const calculatedMetrics = metrics || {
    totalInvoiced: invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0),
    totalPaid: invoices.reduce((sum, inv) => sum + Number(inv.paidAmount || 0), 0),
    pendingAmount: invoices.reduce((sum, inv) => sum + Number(inv.remainingAmount || 0), 0),
    overdueInvoices: invoices.filter(inv => inv.status === 'overdue').length
  };

  if (format === 'pdf') {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    let startY = await addCompanyHeader(doc, company, 15);

    // Título del reporte
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(
      appliedFilters.clientName 
        ? `Informe de Facturación - ${appliedFilters.clientName}`
        : 'Informe de Facturación',
      14,
      startY
    );
    startY += 10;

    // Filtros aplicados
    const filterLabels = createFilterLabels(appliedFilters);
    if (filterLabels.length > 0) {
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      autoTable(doc, { 
        body: filterLabels, 
        startY, 
        theme: 'plain', 
        styles: { fontSize: 9 } 
      });
      startY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Métricas resumidas en formato de cards (2x2)
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Resumen Ejecutivo:', 14, startY);
    
    const metricsData = [
      ['Total Facturado', formatCurrency(calculatedMetrics.totalInvoiced)],
      ['Total Pagado', formatCurrency(calculatedMetrics.totalPaid)],
      ['Saldo Pendiente', formatCurrency(calculatedMetrics.pendingAmount)],
      ['Facturas Vencidas', calculatedMetrics.overdueInvoices.toString()]
    ];
    
    autoTable(doc, {
      body: metricsData,
      startY: startY + 4,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { cellWidth: 60, halign: 'right' }
      }
    });
    startY = (doc as any).lastAutoTable.finalY + 10;

    // Tabla detallada de facturas
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Detalle de Facturas:', 14, startY);
    
    const availableWidth = pageWidth - 28;
    const tableData = invoices.map(invoice => [
      invoice.client?.name || 'N/A',
      invoice.folio || 'N/A',
      invoice.numeroFiscal || 'N/A',
      invoice.issueDate 
        ? formatDate(new Date(invoice.issueDate), 'dd/MM/yy', { locale: es })
        : '-',
      invoice.dueDate 
        ? formatDate(new Date(invoice.dueDate), 'dd/MM/yy', { locale: es })
        : '-',
      invoice.paymentDate 
        ? formatDate(new Date(invoice.paymentDate), 'dd/MM/yy', { locale: es })
        : '-',
      formatCurrency(invoice.subtotal || 0),
      formatCurrency(invoice.vat || 0),
      formatCurrency(invoice.total || 0),
      formatCurrency(invoice.paidAmount || 0),
      formatCurrency(invoice.remainingAmount || 0),
      getStatusLabel(invoice.status)
    ]);

    autoTable(doc, {
      head: [['Cliente', 'Folio', 'N° Fiscal', 'F. Emisión', 'F. Venc.', 'F. Pago', 'Subtotal', 'IVA', 'Total', 'Pagado', 'Saldo', 'Estado']],
      body: tableData,
      startY: startY + 4,
      headStyles: { fillColor: [220, 53, 69], fontSize: 7 },
      styles: { fontSize: 6, cellPadding: 1.5 },
      tableWidth: availableWidth,
      columnStyles: {
        0: { cellWidth: availableWidth * 0.12 },
        1: { cellWidth: availableWidth * 0.07 },
        2: { cellWidth: availableWidth * 0.08 },
        3: { cellWidth: availableWidth * 0.07 },
        4: { cellWidth: availableWidth * 0.07 },
        5: { cellWidth: availableWidth * 0.07 },
        6: { cellWidth: availableWidth * 0.08, halign: 'right' },
        7: { cellWidth: availableWidth * 0.07, halign: 'right' },
        8: { cellWidth: availableWidth * 0.09, halign: 'right' },
        9: { cellWidth: availableWidth * 0.09, halign: 'right' },
        10: { cellWidth: availableWidth * 0.09, halign: 'right' },
        11: { cellWidth: availableWidth * 0.10 }
      }
    });
    
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Totales finales
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('TOTALES:', 14, finalY);
    
    const totalsData = [
      ['Subtotal:', formatCurrency(invoices.reduce((sum, inv) => sum + Number(inv.subtotal || 0), 0))],
      ['IVA:', formatCurrency(invoices.reduce((sum, inv) => sum + Number(inv.vat || 0), 0))],
      ['Total:', formatCurrency(calculatedMetrics.totalInvoiced)],
      ['Pagado:', formatCurrency(calculatedMetrics.totalPaid)],
      ['Saldo Pendiente:', formatCurrency(calculatedMetrics.pendingAmount)]
    ];
    
    autoTable(doc, {
      body: totalsData,
      startY: finalY + 4,
      theme: 'plain',
      styles: { fontSize: 10, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 60, halign: 'right' }
      }
    });

    doc.save(`${exportFileDefaultName}.pdf`);

  } else if (format === 'excel') {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Hoja de resumen
    const summaryData = createExcelSummaryData(invoices, company, appliedFilters, calculatedMetrics);
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumen');

    // Hoja de detalle de facturas
    const detailData = invoices.map(invoice => ({
      'Cliente': invoice.client?.name || '',
      'Folio': invoice.folio || '',
      'Número Fiscal': invoice.numeroFiscal || '',
      'Fecha Emisión': invoice.issueDate,
      'Fecha Vencimiento': invoice.dueDate,
      'Fecha Pago': invoice.paymentDate || '',
      'Subtotal': Number(invoice.subtotal || 0),
      'IVA': Number(invoice.vat || 0),
      'Total': Number(invoice.total || 0),
      'Monto Pagado': Number(invoice.paidAmount || 0),
      'Saldo Pendiente': Number(invoice.remainingAmount || 0),
      'Estado': getStatusLabel(invoice.status),
      'Notas': invoice.notes || ''
    }));
    
    const detailWs = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, detailWs, 'Detalle de Facturas');

    // Hoja de historial de pagos si se solicitó
    if (appliedFilters.includePaymentHistory) {
      const paymentData: any[] = [];
      
      invoices.forEach(invoice => {
        if (invoice.payments && invoice.payments.length > 0) {
          invoice.payments.forEach((payment: any) => {
            paymentData.push({
              'Folio Factura': invoice.folio,
              'Fecha Pago': payment.payment_date,
              'Monto': Number(payment.amount || 0),
              'Método': payment.payment_method || 'Transferencia',
              'Referencia': payment.bank_reference || '',
              'Notas': payment.notes || ''
            });
          });
        }
      });
      
      if (paymentData.length > 0) {
        const paymentWs = XLSX.utils.json_to_sheet(paymentData);
        XLSX.utils.book_append_sheet(wb, paymentWs, 'Historial de Pagos');
      }
    }

    // Hoja de análisis por estado
    const statusData = createStatusAnalysisData(invoices);
    const statusWs = XLSX.utils.json_to_sheet(statusData);
    XLSX.utils.book_append_sheet(wb, statusWs, 'Análisis por Estado');

    XLSX.writeFile(wb, `${exportFileDefaultName}.xlsx`);
  }
};

// Funciones auxiliares
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount);
};

const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    'draft': 'Borrador',
    'sent': 'Enviada',
    'paid': 'Pagada',
    'partial': 'Parcial',
    'overdue': 'Vencida',
    'cancelled': 'Anulada'
  };
  return statusMap[status] || status;
};

const createFilterLabels = (filters: ExportInvoiceReportArgs['appliedFilters']): string[][] => {
  const labels: string[][] = [];
  
  if (filters.clientName) {
    labels.push(['Cliente:', filters.clientName]);
  }
  
  if (filters.dateFrom && filters.dateTo) {
    const formattedFrom = formatDate(new Date(filters.dateFrom), 'dd/MM/yyyy', { locale: es });
    const formattedTo = formatDate(new Date(filters.dateTo), 'dd/MM/yyyy', { locale: es });
    labels.push(['Período:', `${formattedFrom} - ${formattedTo}`]);
  }
  
  if (filters.status && filters.status !== 'all') {
    labels.push(['Estado:', getStatusLabel(filters.status)]);
  }
  
  return labels;
};

const createExcelSummaryData = (
  invoices: any[], 
  company: any, 
  filters: ExportInvoiceReportArgs['appliedFilters'],
  metrics: any
): any[][] => {
  const filterLabels = createFilterLabels(filters);
  
  return [
    [company.name || 'Empresa'],
    [`RUT: ${company.taxId || 'N/A'}`],
    [company.address || ''],
    [`Tel: ${company.phone || 'N/A'} | Email: ${company.email || 'N/A'}`],
    [],
    [filters.clientName ? `Informe de Facturación - ${filters.clientName}` : 'Informe de Facturación'],
    [],
    ['Filtros Aplicados'],
    ...filterLabels,
    [],
    ['Resumen Ejecutivo'],
    ['Métrica', 'Valor'],
    ['Total Facturas', invoices.length],
    ['Total Facturado', metrics.totalInvoiced],
    ['Total Pagado', metrics.totalPaid],
    ['Saldo Pendiente', metrics.pendingAmount],
    ['Facturas Vencidas', metrics.overdueInvoices],
    [],
    ['Detalle por Estado'],
    ['Estado', 'Cantidad', 'Monto Total'],
    ...Object.entries(
      invoices.reduce((acc: any, inv) => {
        const status = getStatusLabel(inv.status);
        if (!acc[status]) {
          acc[status] = { count: 0, total: 0 };
        }
        acc[status].count++;
        acc[status].total += Number(inv.total || 0);
        return acc;
      }, {})
    ).map(([status, data]: [string, any]) => [
      status,
      data.count,
      data.total
    ])
  ];
};

const createStatusAnalysisData = (invoices: any[]): any[] => {
  const statusGroups = invoices.reduce((acc, invoice) => {
    const status = getStatusLabel(invoice.status);
    if (!acc[status]) {
      acc[status] = {
        status,
        count: 0,
        totalAmount: 0,
        paidAmount: 0,
        pendingAmount: 0
      };
    }
    acc[status].count++;
    acc[status].totalAmount += Number(invoice.total || 0);
    acc[status].paidAmount += Number(invoice.paidAmount || 0);
    acc[status].pendingAmount += Number(invoice.remainingAmount || 0);
    return acc;
  }, {} as Record<string, any>);

  return Object.values(statusGroups).map((group: any) => ({
    'Estado': group.status,
    'Cantidad': group.count,
    'Monto Total': group.totalAmount,
    'Monto Pagado': group.paidAmount,
    'Saldo Pendiente': group.pendingAmount,
    'Promedio por Factura': group.count > 0 ? group.totalAmount / group.count : 0
  }));
};
