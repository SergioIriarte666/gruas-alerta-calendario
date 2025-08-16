import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { createExportFileName, addCompanyHeader } from './reportUtils';
import { Settings } from '@/types/settings';
import { PaymentMetrics, SupplierPaymentSummary, ScheduledPayment } from '@/types/supplierPayments';
import { formatCurrency } from '@/lib/utils';

export interface AppliedSupplierPaymentFilters {
  period: 'week' | 'month' | 'quarter' | 'year';
  supplier_id?: string;
  supplierName?: string;
  status?: string;
  dateRange: {
    from: string;
    to: string;
  };
}

export interface ExportSupplierPaymentReportArgs {
  format: 'pdf' | 'excel';
  metrics: PaymentMetrics;
  supplierSummary: SupplierPaymentSummary[];
  upcomingPayments: ScheduledPayment[];
  overduePayments: ScheduledPayment[];
  settings: Settings;
  appliedFilters: AppliedSupplierPaymentFilters;
}

export const exportSupplierPaymentReport = async ({
  format,
  metrics,
  supplierSummary,
  upcomingPayments,
  overduePayments,
  settings,
  appliedFilters
}: ExportSupplierPaymentReportArgs) => {
  const { company } = settings;
  const exportFileDefaultName = createExportFileName(
    'reporte-pagos-proveedores',
    appliedFilters.dateRange.from,
    appliedFilters.dateRange.to
  );

  if (format === 'pdf') {
    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    let startY = await addCompanyHeader(doc, company, 15);

    // Título del reporte
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Reporte de Pagos a Proveedores', 14, startY);
    startY += 10;

    // Filtros aplicados
    const filterLabels = [
      ['Período', getPeriodLabel(appliedFilters.period)],
      ['Fechas', `${formatDate(new Date(appliedFilters.dateRange.from + 'T00:00:00'), 'P', { locale: es })} - ${formatDate(new Date(appliedFilters.dateRange.to + 'T00:00:00'), 'P', { locale: es })}`],
      ['Proveedor', appliedFilters.supplierName || 'Todos los proveedores'],
      ['Estado', appliedFilters.status || 'Todos los estados']
    ];
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    autoTable(doc, {
      body: filterLabels,
      startY,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2 }
    });

    let lastY = (doc as any).lastAutoTable.finalY + 10;

    // Resumen ejecutivo
    const summaryData = [
      ['Total Pendiente', formatCurrency(metrics.total_pending)],
      ['Total Vencido', formatCurrency(metrics.total_overdue)],
      ['Programado Este Mes', formatCurrency(metrics.total_scheduled_this_month)],
      ['Proveedores Activos', metrics.suppliers_count.toString()],
      ['Próximos Pagos (7 días)', upcomingPayments.length.toString()],
      ['Pagos Vencidos', overduePayments.length.toString()]
    ];

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Resumen Ejecutivo', 14, lastY);
    
    autoTable(doc, {
      body: summaryData,
      startY: lastY + 5,
      theme: 'grid',
      headStyles: { fillColor: [220, 53, 69] },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { cellWidth: 50, halign: 'right' }
      }
    });

    lastY = (doc as any).lastAutoTable.finalY + 15;

    // Pagos Vencidos (si existen)
    if (overduePayments.length > 0) {
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Pagos Vencidos - Atención Urgente', 14, lastY);
      
      autoTable(doc, {
        head: [['Proveedor', 'Factura', 'Monto', 'Vencimiento', 'Días Vencido']],
        body: overduePayments.map(payment => [
          payment.supplier_invoice?.supplier?.name || 'N/A',
          payment.supplier_invoice?.invoice_number || 'N/A',
          formatCurrency(payment.amount),
          formatDate(new Date(payment.scheduled_date), 'dd/MM/yyyy'),
          getDaysOverdue(payment.scheduled_date).toString()
        ]),
        startY: lastY + 5,
        headStyles: { fillColor: [220, 53, 69], fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 2 },
        alternateRowStyles: { fillColor: [255, 245, 245] }
      });

      lastY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Próximos Pagos
    if (upcomingPayments.length > 0) {
      // Verificar si necesitamos una nueva página
      if (lastY > 250) {
        doc.addPage();
        lastY = 20;
      }

      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Próximos Pagos (7 días)', 14, lastY);
      
      autoTable(doc, {
        head: [['Proveedor', 'Factura', 'Monto', 'Fecha Programada', 'Método', 'Prioridad']],
        body: upcomingPayments.map(payment => [
          payment.supplier_invoice?.supplier?.name || 'N/A',
          payment.supplier_invoice?.invoice_number || 'N/A',
          formatCurrency(payment.amount),
          formatDate(new Date(payment.scheduled_date), 'dd/MM/yyyy'),
          getPaymentMethodLabel(payment.payment_method),
          getPriorityLabel(payment.priority)
        ]),
        startY: lastY + 5,
        headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 2 },
        alternateRowStyles: { fillColor: [245, 249, 255] }
      });

      lastY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Resumen por Proveedores
    if (supplierSummary.length > 0) {
      // Verificar si necesitamos una nueva página
      if (lastY > 200) {
        doc.addPage();
        lastY = 20;
      }

      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Resumen por Proveedores', 14, lastY);
      
      autoTable(doc, {
        head: [['Proveedor', 'Facturas', 'Total Pendiente', 'Total Vencido', 'Próximo Pago']],
        body: supplierSummary.slice(0, 15).map(supplier => [
          supplier.supplier_name,
          supplier.invoices_count.toString(),
          formatCurrency(supplier.total_pending),
          formatCurrency(supplier.total_overdue),
          supplier.next_payment_date ? formatDate(new Date(supplier.next_payment_date), 'dd/MM/yyyy') : 'N/A'
        ]),
        startY: lastY + 5,
        headStyles: { fillColor: [16, 185, 129], fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 2 },
        alternateRowStyles: { fillColor: [240, 253, 250] }
      });
    }

    // Pie de página con fecha de generación
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(
        `Generado el ${formatDate(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })} - Página ${i} de ${pageCount}`,
        14,
        doc.internal.pageSize.height - 10
      );
    }

    doc.save(`${exportFileDefaultName}.pdf`);

  } else if (format === 'excel') {
    const wb = XLSX.utils.book_new();

    // Hoja 1: Resumen Ejecutivo
    const summaryData = [
      { 'Métrica': 'Total Pendiente', 'Valor': metrics.total_pending, 'Formato': formatCurrency(metrics.total_pending) },
      { 'Métrica': 'Total Vencido', 'Valor': metrics.total_overdue, 'Formato': formatCurrency(metrics.total_overdue) },
      { 'Métrica': 'Programado Este Mes', 'Valor': metrics.total_scheduled_this_month, 'Formato': formatCurrency(metrics.total_scheduled_this_month) },
      { 'Métrica': 'Proveedores Activos', 'Valor': metrics.suppliers_count, 'Formato': metrics.suppliers_count.toString() },
      { 'Métrica': 'Próximos Pagos (7 días)', 'Valor': upcomingPayments.length, 'Formato': upcomingPayments.length.toString() },
      { 'Métrica': 'Pagos Vencidos', 'Valor': overduePayments.length, 'Formato': overduePayments.length.toString() }
    ];
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumen Ejecutivo');

    // Hoja 2: Pagos Vencidos
    if (overduePayments.length > 0) {
      const overdueData = overduePayments.map(payment => ({
        'Proveedor': payment.supplier_invoice?.supplier?.name || 'N/A',
        'RUT Proveedor': payment.supplier_invoice?.supplier?.tax_id || 'N/A',
        'Número Factura': payment.supplier_invoice?.invoice_number || 'N/A',
        'Fecha Emisión': payment.supplier_invoice?.issue_date ? formatDate(new Date(payment.supplier_invoice.issue_date), 'yyyy-MM-dd') : 'N/A',
        'Fecha Vencimiento': formatDate(new Date(payment.scheduled_date), 'yyyy-MM-dd'),
        'Días Vencido': getDaysOverdue(payment.scheduled_date),
        'Monto': payment.amount,
        'Moneda': payment.supplier_invoice?.currency || 'CLP',
        'Estado': 'Vencido',
        'Prioridad': payment.priority,
        'Método Pago': getPaymentMethodLabel(payment.payment_method),
        'Notas': payment.notes || ''
      }));
      const overdueWs = XLSX.utils.json_to_sheet(overdueData);
      XLSX.utils.book_append_sheet(wb, overdueWs, 'Pagos Vencidos');
    }

    // Hoja 3: Próximos Pagos
    if (upcomingPayments.length > 0) {
      const upcomingData = upcomingPayments.map(payment => ({
        'Proveedor': payment.supplier_invoice?.supplier?.name || 'N/A',
        'RUT Proveedor': payment.supplier_invoice?.supplier?.tax_id || 'N/A',
        'Número Factura': payment.supplier_invoice?.invoice_number || 'N/A',
        'Fecha Emisión': payment.supplier_invoice?.issue_date ? formatDate(new Date(payment.supplier_invoice.issue_date), 'yyyy-MM-dd') : 'N/A',
        'Fecha Programada': formatDate(new Date(payment.scheduled_date), 'yyyy-MM-dd'),
        'Días Restantes': getDaysUntilPayment(payment.scheduled_date),
        'Monto': payment.amount,
        'Moneda': payment.supplier_invoice?.currency || 'CLP',
        'Estado': payment.status,
        'Prioridad': payment.priority,
        'Método Pago': getPaymentMethodLabel(payment.payment_method),
        'Notas': payment.notes || ''
      }));
      const upcomingWs = XLSX.utils.json_to_sheet(upcomingData);
      XLSX.utils.book_append_sheet(wb, upcomingWs, 'Próximos Pagos');
    }

    // Hoja 4: Resumen por Proveedores
    if (supplierSummary.length > 0) {
      const supplierData = supplierSummary.map(supplier => ({
        'Proveedor': supplier.supplier_name,
        'ID Proveedor': supplier.supplier_id,
        'Cantidad Facturas': supplier.invoices_count,
        'Total Pendiente': supplier.total_pending,
        'Total Vencido': supplier.total_overdue,
        'Próximo Pago Fecha': supplier.next_payment_date ? formatDate(new Date(supplier.next_payment_date), 'yyyy-MM-dd') : 'N/A',
        'Próximo Pago Monto': supplier.next_payment_amount || 0,
        'Términos Pago Promedio': supplier.average_payment_terms
      }));
      const supplierWs = XLSX.utils.json_to_sheet(supplierData);
      XLSX.utils.book_append_sheet(wb, supplierWs, 'Resumen Proveedores');
    }

    XLSX.writeFile(wb, `${exportFileDefaultName}.xlsx`);
  }
};

// Funciones auxiliares
const getPeriodLabel = (period: string): string => {
  const labels = {
    'week': 'Esta Semana',
    'month': 'Este Mes',
    'quarter': 'Este Trimestre',
    'year': 'Este Año'
  };
  return labels[period as keyof typeof labels] || period;
};

const getPaymentMethodLabel = (method?: string): string => {
  const labels = {
    'transfer': 'Transferencia',
    'check': 'Cheque',
    'cash': 'Efectivo',
    'credit': 'Crédito'
  };
  return labels[method as keyof typeof labels] || method || 'N/A';
};

const getPriorityLabel = (priority: string): string => {
  const labels = {
    'low': 'Baja',
    'medium': 'Media',
    'high': 'Alta',
    'urgent': 'Urgente'
  };
  return labels[priority as keyof typeof labels] || priority;
};

const getDaysOverdue = (scheduledDate: string): number => {
  const today = new Date();
  const dueDate = new Date(scheduledDate);
  const diffTime = today.getTime() - dueDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getDaysUntilPayment = (scheduledDate: string): number => {
  const today = new Date();
  const paymentDate = new Date(scheduledDate);
  const diffTime = paymentDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};