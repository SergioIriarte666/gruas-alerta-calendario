import { ExportSupplierPaymentReportArgs } from './reportTypes';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { businessClock } from '@/utils/businessClock';
import { fetchCompanyData } from '@/utils/pdf/companyDataFetcher';
import { addCompanyHeader } from '@/utils/reports/reportUtils';

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const exportSupplierPaymentReport = async ({
  format,
  payments,
  suppliers,
  categories,
  settings,
  appliedFilters,
}: ExportSupplierPaymentReportArgs) => {
  if (format === 'pdf') {
    await generatePDF(payments, suppliers, categories, settings, appliedFilters);
  } else {
    await generateExcel(payments, suppliers, categories, settings, appliedFilters);
  }
};

const generatePDF = async (payments: any[], suppliers: any[], categories: any[], settings: any, filters: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const today = businessClock.format(businessClock.now(), 'dd/MM/yyyy');
  
  // Helper function to get supplier name
  const getSupplierName = (supplierId: string) => {
    return suppliers.find(s => s.id === supplierId)?.name || 'N/A';
  };
  
  // Helper function to get category label
  const getCategoryLabel = (categoryId: string | null) => {
    if (!categoryId) return 'Sin categoría';

    const category = categories.find((c: any) => c.id === categoryId);
    if (category) return category.label || category.name || 'Sin categoría';

    // Categoría legacy guardada como texto
    if (!isUuid(categoryId)) return categoryId;

    return 'Sin categoría';
  };
  
  // Obtener datos de empresa
  const companyData = await fetchCompanyData();
  
  // Calcular métricas
  const metrics = calculateMetrics(payments, filters);
  
  // Agregar header profesional con logo y datos de empresa
  let yPos = await addCompanyHeader(doc, {
    name: companyData.businessName,
    taxId: companyData.rut,
    address: companyData.address,
    phone: companyData.phone,
    email: companyData.email,
    logo: companyData.logoUrl,
    folioFormat: 'SRV-{number}' // Campo requerido por CompanySettings
  }, 10);
  
  // Título del reporte
  yPos += 10;
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  
  const title = filters.reportType === 'future' 
    ? `Proyección de Pagos a Proveedores - Próximos ${filters.daysAhead || 30} días`
    : 'Listado de Pagos a Proveedores';
    
  doc.text(title, pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  
  // Fecha de generación
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generado el: ${today}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;
  
  // Applied filters
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('Filtros aplicados:', 14, yPos);
  yPos += 7;
  
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  
  if (filters.searchTerm) {
    doc.text(`• Búsqueda: ${filters.searchTerm}`, 14, yPos);
    yPos += 5;
  }
  
  if (filters.status && filters.status !== 'all') {
    const statusLabels = {
      pending: 'Pendiente',
      paid: 'Pagado',
      overdue: 'Vencido',
      cancelled: 'Cancelado'
    };
    doc.text(`• Estado: ${statusLabels[filters.status] || filters.status}`, 14, yPos);
    yPos += 5;
  }
  
  if (filters.supplierName) {
    doc.text(`• Proveedor: ${filters.supplierName}`, 14, yPos);
    yPos += 5;
  }
  
  // Filtros de fecha
  if (filters.dateFrom || filters.dateTo) {
    const getDateTypeLabel = (type: string) => {
      switch (type) {
        case 'due_date': return 'Fecha de Vencimiento';
        case 'created_at': return 'Fecha de Creación';
        case 'paid_date': return 'Fecha de Pago';
        default: return 'Fecha de Vencimiento';
      }
    };
    
    const dateTypeLabel = getDateTypeLabel(filters.dateType);
    let dateRangeText = `• ${dateTypeLabel}:`;
    
    if (filters.dateFrom && filters.dateTo) {
      dateRangeText += ` desde ${format(new Date(filters.dateFrom), 'dd/MM/yyyy')} hasta ${format(new Date(filters.dateTo), 'dd/MM/yyyy')}`;
    } else if (filters.dateFrom) {
      dateRangeText += ` desde ${format(new Date(filters.dateFrom), 'dd/MM/yyyy')}`;
    } else if (filters.dateTo) {
      dateRangeText += ` hasta ${format(new Date(filters.dateTo), 'dd/MM/yyyy')}`;
    }
    
    doc.text(dateRangeText, 14, yPos);
    yPos += 5;
  }
  
  if (!filters.searchTerm && (!filters.status || filters.status === 'all') && 
      !filters.supplierName && !filters.dateFrom && !filters.dateTo) {
    doc.text('• Sin filtros aplicados (todos los pagos)', 14, yPos);
    yPos += 5;
  }
  
  yPos += 5;
  
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
    getCategoryLabel(payment.category),
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
  const filename = `pagos_proveedores_${filters.reportType}_${businessClock.today()}.pdf`;
  doc.save(filename);
};

const generateExcel = async (payments: any[], suppliers: any[], categories: any[], settings: any, filters: any) => {
  const workbook = XLSX.utils.book_new();
  const metrics = calculateMetrics(payments, filters);
  
  // Obtener datos de empresa
  const companyData = await fetchCompanyData();
  
  // Helper function to get supplier name
  const getSupplierName = (supplierId: string) => {
    return suppliers.find(s => s.id === supplierId)?.name || 'N/A';
  };
  
  // Helper function to get category label
  const getCategoryLabel = (categoryId: string | null) => {
    if (!categoryId) return 'Sin categoría';

    const category = categories.find((c: any) => c.id === categoryId);
    if (category) return category.label || category.name || 'Sin categoría';

    // Categoría legacy guardada como texto
    if (!isUuid(categoryId)) return categoryId;

    return 'Sin categoría';
  };
  
  const getDateTypeLabel = (type: string) => {
    switch (type) {
      case 'due_date': return 'Fecha de Vencimiento';
      case 'created_at': return 'Fecha de Creación';
      case 'paid_date': return 'Fecha de Pago';
      default: return 'Fecha de Vencimiento';
    }
  };
  
  // Summary sheet
  const summaryData = [
    ['Reporte de Pagos a Proveedores'],
    [''],
    ['Empresa:', companyData.businessName],
    ['RUT:', companyData.rut],
    ['Dirección:', companyData.address],
    ['Teléfono:', companyData.phone],
    ['Email:', companyData.email],
    ['Fecha de generación:', businessClock.format(businessClock.now(), 'dd/MM/yyyy')],
    ['Tipo de reporte:', filters.reportType === 'future' ? 'Pagos Futuros' : 'Listado Completo'],
    [''],
    ['Filtros aplicados:'],
    ['Proveedor:', filters.supplierName || 'Todos'],
    ['Estado:', filters.status ? getStatusLabel(filters.status) : 'Todos'],
    ['Búsqueda:', filters.searchTerm || 'Sin filtros'],
    ...(filters.dateFrom || filters.dateTo ? [
      ['Tipo de fecha:', getDateTypeLabel(filters.dateType || 'due_date')],
      ...(filters.dateFrom ? [['Fecha desde:', format(new Date(filters.dateFrom), 'dd/MM/yyyy')]] : []),
      ...(filters.dateTo ? [['Fecha hasta:', format(new Date(filters.dateTo), 'dd/MM/yyyy')]] : [])
    ] : []),
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
      getCategoryLabel(payment.category),
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
  const filename = `pagos_proveedores_${filters.reportType}_${businessClock.today()}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

const calculateMetrics = (payments: any[], filters: any) => {
  const today = businessClock.todayDate();
  
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