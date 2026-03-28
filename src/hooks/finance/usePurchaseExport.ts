import { useCallback } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SupplierInvoiceWithDetails } from '@/types/suppliers';
import { formatCurrency } from '@/lib/utils';

export const usePurchaseExport = () => {
  const exportToExcel = useCallback((invoices: SupplierInvoiceWithDetails[], fileName: string = 'reporte-compras') => {
    try {
      const wb = XLSX.utils.book_new();
      
      // Transform data for Excel
      const data = invoices.map(inv => ({
        'Folio': inv.invoice_number,
        'Proveedor': inv.supplier?.name || 'Sin Proveedor',
        'RUT Proveedor': inv.supplier?.rut || 'N/A',
        'Fecha Emisión': format(new Date(inv.issue_date), 'dd/MM/yyyy'),
        'Fecha Vencimiento': format(new Date(inv.due_date), 'dd/MM/yyyy'),
        'Descripción de Producto o Servicio': inv.product_service_description || inv.description || '',
        'Estado': inv.status === 'paid' ? 'Pagada' : inv.status === 'overdue' ? 'Vencida' : 'Pendiente',
        'Monto Neto': inv.net_amount,
        'Impuestos': inv.tax_amount,
        'Monto Total': inv.amount,
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      
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
      XLSX.writeFile(wb, `${fileName}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      
      toast.success('Reporte Excel generado correctamente');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Error al generar el reporte Excel');
    }
  }, []);

  const exportToPDF = useCallback((invoices: SupplierInvoiceWithDetails[], fileName: string = 'reporte-compras') => {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.text('Reporte de Compras Históricas', 14, 20);
      
      doc.setFontSize(10);
      doc.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`, 14, 30);
      
      // Calculate totals
      const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      const totalNet = invoices.reduce((sum, inv) => sum + (inv.net_amount || 0), 0);
      const totalTax = invoices.reduce((sum, inv) => sum + (inv.tax_amount || 0), 0);
      
      doc.text(`Total Registros: ${invoices.length}`, 14, 40);
      doc.text(`Monto Total: ${formatCurrency(totalAmount)}`, 14, 45);
      
      // Table
      const tableData = invoices.map(inv => [
        inv.invoice_number,
        inv.supplier?.name || 'Sin Proveedor',
        format(new Date(inv.issue_date), 'dd/MM/yyyy'),
        (inv.product_service_description || inv.description || '').slice(0, 60),
        inv.status === 'paid' ? 'Pagada' : inv.status === 'overdue' ? 'Vencida' : 'Pendiente',
        formatCurrency(inv.amount)
      ]);

      autoTable(doc, {
        startY: 55,
        head: [['Folio', 'Proveedor', 'Fecha', 'Descripción', 'Estado', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 8 },
        foot: [['', '', '', '', 'Total:', formatCurrency(totalAmount)]],
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
      });

      doc.save(`${fileName}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
      toast.success('Reporte PDF generado correctamente');
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast.error('Error al generar el reporte PDF');
    }
  }, []);

  return {
    exportToExcel,
    exportToPDF
  };
};
