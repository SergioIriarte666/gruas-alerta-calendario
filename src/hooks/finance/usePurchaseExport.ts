
import { useCallback } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { SupplierInvoiceWithDetails } from '@/types/suppliers';
import { formatCurrency } from '@/lib/utils';
import { createLogger } from "@/lib/logger";
import { businessClock } from '@/utils/businessClock';
import {
  addReportFooter,
  addReportHeader,
  REPORT_PDF_COLORS,
} from '@/utils/pdf/reportPdfTheme';

const logger = createLogger("usePurchaseExport");

interface ExportMeta {
  periodLabel?: string;
  sourceLabel?: string;
}

export const usePurchaseExport = () => {
  // Las librerías xlsx/jspdf se cargan dinámicamente solo al exportar, para no
  // incluirlas en el bundle inicial del módulo.
  const exportToExcel = useCallback(async (
    invoices: SupplierInvoiceWithDetails[],
    fileName: string = 'reporte-compras',
    meta?: ExportMeta
  ) => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Transform data for Excel
      const data = invoices.map(inv => ({
        'Folio': inv.invoice_number,
        'Proveedor': inv.supplier?.name || 'Sin Proveedor',
        'RUT Proveedor': inv.supplier?.rut || 'N/A',
        'Fecha Emisión': businessClock.format(inv.issue_date, 'dd/MM/yyyy'),
        'Fecha Vencimiento': businessClock.format(inv.due_date, 'dd/MM/yyyy'),
        'Descripción de Producto o Servicio': inv.product_service_description || inv.description || '',
        'Estado': inv.status === 'paid' ? 'Pagada' : inv.status === 'overdue' ? 'Vencida' : 'Pendiente',
        'Monto Neto': inv.net_amount,
        'Impuestos': inv.tax_amount,
        'Monto Total': inv.amount,
      }));

      const metaRows = [
        { 'Folio': `Período: ${meta?.periodLabel || 'Todos'}` },
        { 'Folio': `Origen: ${meta?.sourceLabel || 'Todos'}` },
        { 'Folio': `Generado: ${businessClock.format(businessClock.now(), 'dd/MM/yyyy HH:mm')}` },
        { 'Folio': '' },
      ];

      const ws = XLSX.utils.json_to_sheet([...metaRows, ...data]);

      // Auto-width columns
      const colWidths = [
        { wch: 15 }, // Folio
        { wch: 30 }, // Proveedor
        { wch: 15 }, // RUT
        { wch: 15 }, // Emisión
        { wch: 15 }, // Vencimiento
        { wch: 50 }, // Descripción
        { wch: 15 }, // Estado
        { wch: 15 }, // Neto
        { wch: 15 }, // Impuestos
        { wch: 15 }, // Total
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Compras');

      // Generate file
      XLSX.writeFile(wb, `${fileName}-${businessClock.today()}.xlsx`);

      toast.success('Reporte Excel generado correctamente');
    } catch (error) {
      logger.error('Error exporting to Excel:', error);
      toast.error('Error al generar el reporte Excel');
    }
  }, []);

  const exportToPDF = useCallback(async (
    invoices: SupplierInvoiceWithDetails[],
    fileName: string = 'reporte-compras',
    meta?: ExportMeta
  ) => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();

      // Header
      const headerY = await addReportHeader(doc, { name: 'Grúas 5 Norte' });
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...REPORT_PDF_COLORS.ink);
      doc.text('Reporte de compras históricas', 14, headerY);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...REPORT_PDF_COLORS.muted);
      doc.text(`Período: ${meta?.periodLabel || 'Todos'} · Origen: ${meta?.sourceLabel || 'Todos'}`, 14, headerY + 7);

      // Calculate totals
      const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

      doc.setTextColor(...REPORT_PDF_COLORS.ink);
      doc.text(`Total registros: ${invoices.length} · Monto total: ${formatCurrency(totalAmount)}`, 14, headerY + 15);

      // Table
      const tableData = invoices.map(inv => [
        inv.invoice_number,
        inv.supplier?.name || 'Sin Proveedor',
        businessClock.format(inv.issue_date, 'dd/MM/yyyy'),
        (inv.product_service_description || inv.description || '').slice(0, 60),
        inv.status === 'paid' ? 'Pagada' : inv.status === 'overdue' ? 'Vencida' : 'Pendiente',
        formatCurrency(inv.amount)
      ]);

      autoTable(doc, {
        startY: headerY + 23,
        head: [['Folio', 'Proveedor', 'Fecha', 'Descripción', 'Estado', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: REPORT_PDF_COLORS.primary },
        styles: { fontSize: 8 },
        foot: [['', '', '', '', 'Total:', formatCurrency(totalAmount)]],
        footStyles: { fillColor: REPORT_PDF_COLORS.total, textColor: REPORT_PDF_COLORS.ink, fontStyle: 'bold' }
      });

      addReportFooter(doc);
      doc.save(`${fileName}-${businessClock.today()}.pdf`);

      toast.success('Reporte PDF generado correctamente');
    } catch (error) {
      logger.error('Error exporting to PDF:', error);
      toast.error('Error al generar el reporte PDF');
    }
  }, []);

  return {
    exportToExcel,
    exportToPDF
  };
};
