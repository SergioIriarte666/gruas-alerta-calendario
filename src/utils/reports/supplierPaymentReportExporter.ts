import { ExportSupplierPaymentReportArgs } from './reportTypes';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format, addDays, isBefore, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';

export const exportSupplierPaymentReport = async ({
  format,
  payments,
  suppliers,
  settings,
  appliedFilters,
}: ExportSupplierPaymentReportArgs) => {
  if (format === 'pdf') {
    generatePDF(payments, suppliers, settings, appliedFilters);
  } else {
    generateExcel(payments, suppliers, settings, appliedFilters);
  }
};

const generatePDF = (payments: any[], suppliers: any[], settings: any, filters: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const today = format(new Date(), 'dd/MM/yyyy', { locale: es });
  
  // Helper function to get supplier name
  const getSupplierName = (supplierId: string) => {
    return suppliers.find(s => s.id === supplierId)?.name || 'N/A';
  };
  
  // Calcular métricas
  const metrics = calculateMetrics(payments, filters);
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(0, 0, 0);
  
  const title = filters.reportType === 'future' 
    ? `Proyección de Pagos a Proveedores - Próximos ${filters.daysAhead} días`
    : 'Listado de Pagos a Proveedores';
    
  doc.text(title, pageWidth / 2, 20, { align: 'center' });
  
  // Company info
  doc.setFontSize(12);
  doc.text(settings.company_name || 'Empresa', 14, 35);
  doc.text(`Generado el: ${today}`, 14, 42);
  
  // Applied filters
  let yPos = 55;
  doc.setFontSize(11);
  doc.text('Filtros aplicados:', 14, yPos);
  yPos += 7;
  
  if (filters.supplierName) {
    doc.text(`• Proveedor: ${filters.supplierName}`, 20, yPos);
    yPos += 5;
  }
  if (filters.status) {
    doc.text(`• Estado: ${getStatusLabel(filters.status)}`, 20, yPos);
    yPos += 5;
  }
  if (filters.searchTerm) {
    doc.text(`• Búsqueda: ${filters.searchTerm}`, 20, yPos);
    yPos += 5;
  }
  
  // Summary metrics
  yPos += 10;
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('Resumen:', 14, yPos);
  yPos += 7;
  
  doc.setFontSize(10);
  doc.text(`Total de pagos: ${metrics.totalPayments}`, 20, yPos);
  yPos += 5;
  doc.text(`Monto total: $${metrics.totalAmount.toLocaleString()}`, 20, yPos);
  yPos += 5;
  
  if (filters.reportType === 'future') {
    doc.text(`Pagos próximos 7 días: ${metrics.next7Days} ($${metrics.amount7Days.toLocaleString()})`, 20, yPos);
    yPos += 5;
    doc.text(`Pagos próximos 30 días: ${metrics.next30Days} ($${metrics.amount30Days.toLocaleString()})`, 20, yPos);
    yPos += 5;
  } else {
    doc.text(`Pagos pendientes: ${metrics.pendingCount} ($${metrics.pendingAmount.toLocaleString()})`, 20, yPos);
    yPos += 5;
    doc.text(`Pagos vencidos: ${metrics.overdueCount} ($${metrics.overdueAmount.toLocaleString()})`, 20, yPos);
    yPos += 5;
  }
  
  // Table
  const tableData = payments.map(payment => [
    getSupplierName(payment.supplier_id),
    payment.description,
    payment.category || 'N/A',
    `$${payment.amount.toLocaleString()}`,
    format(new Date(payment.due_date), 'dd/MM/yyyy', { locale: es }),
    getStatusLabel(payment.status),
    payment.reference_number || '-'
  ]);
  
  autoTable(doc, {
    startY: yPos + 10,
    head: [['Proveedor', 'Descripción', 'Categoría', 'Monto', 'Vencimiento', 'Estado', 'Referencia']],
    body: tableData,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      3: { halign: 'right' }, // Amount column
      4: { halign: 'center' }, // Due date column
    },
  });
  
  // Save PDF
  const filename = `pagos_proveedores_${filters.reportType}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
};

const generateExcel = (payments: any[], suppliers: any[], settings: any, filters: any) => {
  const workbook = XLSX.utils.book_new();
  const metrics = calculateMetrics(payments, filters);
  
  // Helper function to get supplier name
  const getSupplierName = (supplierId: string) => {
    return suppliers.find(s => s.id === supplierId)?.name || 'N/A';
  };
  
  // Summary sheet
  const summaryData = [
    ['Reporte de Pagos a Proveedores'],
    [''],
    ['Empresa:', settings.company_name || 'N/A'],
    ['Fecha de generación:', format(new Date(), 'dd/MM/yyyy', { locale: es })],
    ['Tipo de reporte:', filters.reportType === 'future' ? 'Pagos Futuros' : 'Listado Completo'],
    [''],
    ['Filtros aplicados:'],
    ['Proveedor:', filters.supplierName || 'Todos'],
    ['Estado:', filters.status ? getStatusLabel(filters.status) : 'Todos'],
    ['Búsqueda:', filters.searchTerm || 'Sin filtros'],
    [''],
    ['Métricas:'],
    ['Total de pagos:', metrics.totalPayments],
    ['Monto total:', metrics.totalAmount],
  ];
  
  if (filters.reportType === 'future') {
    summaryData.push(
      ['Pagos próximos 7 días:', metrics.next7Days],
      ['Monto próximos 7 días:', metrics.amount7Days],
      ['Pagos próximos 30 días:', metrics.next30Days],
      ['Monto próximos 30 días:', metrics.amount30Days]
    );
  } else {
    summaryData.push(
      ['Pagos pendientes:', metrics.pendingCount],
      ['Monto pendiente:', metrics.pendingAmount],
      ['Pagos vencidos:', metrics.overdueCount],
      ['Monto vencido:', metrics.overdueAmount]
    );
  }
  
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summaryWs, 'Resumen');
  
  // Detail sheet
  const detailData = [
    ['Proveedor', 'Descripción', 'Categoría', 'Monto', 'Fecha Vencimiento', 'Estado', 'Referencia', 'Fecha Creación']
  ];
  
  payments.forEach(payment => {
    detailData.push([
      getSupplierName(payment.supplier_id),
      payment.description,
      payment.category || 'N/A',
      payment.amount,
      format(new Date(payment.due_date), 'dd/MM/yyyy', { locale: es }),
      getStatusLabel(payment.status),
      payment.reference_number || '-',
      format(new Date(payment.created_at), 'dd/MM/yyyy', { locale: es })
    ]);
  });
  
  const detailWs = XLSX.utils.aoa_to_sheet(detailData);
  XLSX.utils.book_append_sheet(workbook, detailWs, 'Detalle');
  
  // Future payments analysis (if future report)
  if (filters.reportType === 'future') {
    const periodsData = [
      ['Período', 'Cantidad', 'Monto Total'],
      ['Próximos 7 días', metrics.next7Days, metrics.amount7Days],
      ['8-15 días', metrics.next8to15Days, metrics.amount8to15Days],
      ['16-30 días', metrics.next16to30Days, metrics.amount16to30Days],
      ['31-60 días', metrics.next31to60Days, metrics.amount31to60Days],
      ['61-90 días', metrics.next61to90Days, metrics.amount61to90Days],
    ];
    
    const periodsWs = XLSX.utils.aoa_to_sheet(periodsData);
    XLSX.utils.book_append_sheet(workbook, periodsWs, 'Por Períodos');
  }
  
  // Save Excel
  const filename = `pagos_proveedores_${filters.reportType}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

const calculateMetrics = (payments: any[], filters: any) => {
  const today = new Date();
  
  const metrics = {
    totalPayments: payments.length,
    totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
    pendingCount: 0,
    pendingAmount: 0,
    overdueCount: 0,
    overdueAmount: 0,
    next7Days: 0,
    amount7Days: 0,
    next8to15Days: 0,
    amount8to15Days: 0,
    next16to30Days: 0,
    amount16to30Days: 0,
    next30Days: 0,
    amount30Days: 0,
    next31to60Days: 0,
    amount31to60Days: 0,
    next61to90Days: 0,
    amount61to90Days: 0,
  };
  
  payments.forEach(payment => {
    const dueDate = new Date(payment.due_date);
    
    if (payment.status === 'pending') {
      metrics.pendingCount++;
      metrics.pendingAmount += payment.amount;
    } else if (payment.status === 'overdue') {
      metrics.overdueCount++;
      metrics.overdueAmount += payment.amount;
    }
    
    if (filters.reportType === 'future' && payment.status === 'pending') {
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDue <= 7) {
        metrics.next7Days++;
        metrics.amount7Days += payment.amount;
      } else if (daysUntilDue <= 15) {
        metrics.next8to15Days++;
        metrics.amount8to15Days += payment.amount;
      } else if (daysUntilDue <= 30) {
        metrics.next16to30Days++;
        metrics.amount16to30Days += payment.amount;
      } else if (daysUntilDue <= 60) {
        metrics.next31to60Days++;
        metrics.amount31to60Days += payment.amount;
      } else if (daysUntilDue <= 90) {
        metrics.next61to90Days++;
        metrics.amount61to90Days += payment.amount;
      }
      
      if (daysUntilDue <= 30) {
        metrics.next30Days++;
        metrics.amount30Days += payment.amount;
      }
    }
  });
  
  return metrics;
};

const getStatusLabel = (status: string): string => {
  const statusLabels: Record<string, string> = {
    'pending': 'Pendiente',
    'paid': 'Pagado',
    'overdue': 'Vencido',
    'cancelled': 'Cancelado',
  };
  return statusLabels[status] || status;
};