import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { IncomeWithDetails } from '@/types/incomes';
import { addCompanyHeader, createExportFileName } from './reportUtils';

export interface ExportIncomeReportArgs {
  format: 'pdf' | 'excel';
  incomes: IncomeWithDetails[];
  companyData: any;
  appliedFilters?: {
    dateFrom?: string;
    dateTo?: string;
    category?: string;
    client?: string;
  };
}

export const exportIncomeReport = async ({ 
  format, 
  incomes, 
  companyData,
  appliedFilters = {}
}: ExportIncomeReportArgs) => {
  const fileName = createExportFileName(
    'informe-ingresos', 
    appliedFilters.dateFrom || '', 
    appliedFilters.dateTo || ''
  );

  if (format === 'pdf') {
    const doc = new jsPDF();
    let yPosition = await addCompanyHeader(doc, companyData, 20);

    // Título del informe
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0);
    doc.text('Informe de Ingresos', 14, yPosition);
    yPosition += 10;

    // Filtros aplicados
    if (appliedFilters.dateFrom || appliedFilters.dateTo || appliedFilters.category || appliedFilters.client) {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('Filtros aplicados:', 14, yPosition);
      yPosition += 5;

      if (appliedFilters.dateFrom && appliedFilters.dateTo) {
        doc.text(`Período: ${formatDate(new Date(appliedFilters.dateFrom), 'dd/MM/yyyy', { locale: es })} - ${formatDate(new Date(appliedFilters.dateTo), 'dd/MM/yyyy', { locale: es })}`, 14, yPosition);
        yPosition += 5;
      }
      if (appliedFilters.category) {
        doc.text(`Categoría: ${appliedFilters.category}`, 14, yPosition);
        yPosition += 5;
      }
      if (appliedFilters.client) {
        doc.text(`Cliente: ${appliedFilters.client}`, 14, yPosition);
        yPosition += 5;
      }
      yPosition += 5;
    }

    // Tabla de ingresos
    autoTable(doc, {
      startY: yPosition,
      head: [['Fecha', 'Descripción', 'Categoría', 'Cliente', 'Método', 'Referencia', 'Monto']],
      body: incomes.map(income => [
        formatDate(new Date(income.income_date), 'dd/MM/yyyy', { locale: es }),
        income.description,
        income.category?.name || '-',
        income.occasional_client_name || income.client?.name || '-',
        income.payment_method,
        income.bank_reference || '-',
        `$${income.amount.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255 },
      alternateRowStyles: { fillColor: [243, 244, 246] },
    });

    // Totales
    const totalAmount = incomes.reduce((sum, i) => sum + i.amount, 0);
    const finalY = (doc as any).lastAutoTable.finalY || yPosition;

    autoTable(doc, {
      startY: finalY + 5,
      body: [
        ['TOTAL GENERAL', '', '', '', '', '', `$${totalAmount.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`]
      ],
      theme: 'grid',
      styles: { fontStyle: 'bold', fontSize: 10, fillColor: [220, 252, 231] },
      columnStyles: {
        6: { halign: 'right' }
      }
    });

    doc.save(`${fileName}.pdf`);
  } else {
    // Excel export
    const wsData = incomes.map(income => ({
      'Fecha': formatDate(new Date(income.income_date), 'dd/MM/yyyy', { locale: es }),
      'Descripción': income.description,
      'Categoría': income.category?.name || '-',
      'Subcategoría': income.subcategory || '-',
      'Cliente': income.occasional_client_name || income.client?.name || '-',
      'Método de Pago': income.payment_method,
      'Referencia Bancaria': income.bank_reference || '-',
      'Monto': income.amount,
      'Notas': income.notes || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    
    // Formato de columna de monto
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: 7 }); // Columna H (Monto)
      if (ws[cellAddress]) {
        ws[cellAddress].z = '#,##0';
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ingresos');
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  }
};
