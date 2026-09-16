import { businessClock } from '@/utils/businessClock';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { es } from 'date-fns/locale';
import { Commission } from '@/types/commissions';
import { ExportCommissionReportArgs, AppliedCommissionFilters } from './reportTypes';
import {
  createExportFileName,
  addCompanyHeader,
  addStandardReportFooter,
  REPORT_PDF_COLORS,
} from './reportUtils';
import { Settings } from '@/types/settings';

export const exportCommissionReport = async ({ 
  format, 
  commissions, 
  settings, 
  appliedFilters 
}: ExportCommissionReportArgs) => {
  const { company } = settings;
  const exportFileDefaultName = createExportFileName(
    'comisiones', 
    appliedFilters.dateFrom || 'inicio', 
    appliedFilters.dateTo || 'fin'
  );

  if (format === 'pdf') {
    const doc = new jsPDF('l'); // 'l' para landscape (horizontal)
    let startY = await addCompanyHeader(doc, company, 15);

    // Título del reporte
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0);
    doc.text('Reporte de Comisiones', 14, startY);
    startY += 10;

    // Filtros aplicados
    const filterLabels = createFilterLabels(appliedFilters);
    if (filterLabels.length > 0) {
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.text('Filtros Aplicados:', 14, startY);
      autoTable(doc, { 
        body: filterLabels, 
        startY: startY + 4, 
        theme: 'plain', 
        styles: { fontSize: 9 } 
      });
      startY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Resumen ejecutivo
    const summary = calculateCommissionSummary(commissions);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Resumen Ejecutivo:', 14, startY);
    
    autoTable(doc, {
      body: [
        ['Total Comisiones', commissions.length.toString()],
        ['Comisiones Pendientes', summary.pendingCount.toString()],
        ['Comisiones Pagadas', summary.paidCount.toString()],
        ['Total Pendiente', formatCurrency(summary.totalPending)],
        ['Total Pagado', formatCurrency(summary.totalPaid)],
        ['Total General', formatCurrency(summary.total)],
        ['Comisión Promedio', formatCurrency(summary.average)],
      ],
      startY: startY + 4,
      theme: 'grid',
      styles: { fontSize: 9 }
    });
    startY = (doc as any).lastAutoTable.finalY + 10;

    // Tabla detallada de comisiones
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Detalle de Comisiones:', 14, startY);
    
    const tableData = commissions.map(commission => [
      commission.status === 'paid' ? 'Pagada' : 'Pendiente',
      commission.service_folio || 'N/A',
      commission.services?.service_date 
        ? businessClock.format(commission.services.service_date, 'dd/MM/yyyy', { locale: es })
        : businessClock.format(commission.date, 'dd/MM/yyyy', { locale: es }),
      commission.client_name || 'N/A',
      commission.operators?.name || 'N/A',
      commission.service_value ? formatCurrency(commission.service_value) : 'N/A',
      formatCurrency(commission.amount),
      commission.commission_percentage ? `${commission.commission_percentage}%` : 'N/A'
    ]);

    autoTable(doc, {
      head: [['Estado', 'Folio', 'Fecha', 'Cliente', 'Operador', 'Valor Servicio', 'Comisión', '%']],
      body: tableData,
      startY: startY + 4,
      styles: { fontSize: 8 },
      headStyles: { fillColor: REPORT_PDF_COLORS.primary },
      columnStyles: {
        5: { halign: 'right' }, // Valor Servicio
        6: { halign: 'right' }, // Comisión
        7: { halign: 'right' }, // Porcentaje
      }
    });

    addStandardReportFooter(doc);
    doc.save(`${exportFileDefaultName}.pdf`);

  } else if (format === 'excel') {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Hoja de resumen
    const summaryData = createExcelSummaryData(commissions, company, appliedFilters);
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumen');

    // Hoja de detalle
    const detailData = commissions.map(commission => ({
      'Estado': commission.status === 'paid' ? 'Pagada' : 'Pendiente',
      'Folio': commission.service_folio || 'N/A',
      'Fecha Servicio': commission.services?.service_date 
        ? businessClock.format(commission.services.service_date, 'dd/MM/yyyy', { locale: es })
        : businessClock.format(commission.date, 'dd/MM/yyyy', { locale: es }),
      'Cliente': commission.client_name || 'N/A',
      'Operador': commission.operators?.name || 'N/A',
      'Valor Servicio': commission.service_value || 0,
      'Comisión': commission.amount,
      'Porcentaje': commission.commission_percentage || 0,
      'Descripción': commission.description || '',
      'Fecha Creación': businessClock.format(commission.created_at, 'dd/MM/yyyy HH:mm', { locale: es })
    }));

    const detailWs = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, detailWs, 'Detalle');

    // Hoja por operador si hay múltiples operadores
    const operatorGroups = groupCommissionsByOperator(commissions);
    if (operatorGroups.length > 1) {
      const operatorSummary = operatorGroups.map(group => ({
        'Operador': group.operatorName,
        'Total Comisiones': group.commissions.length,
        'Pendientes': group.commissions.filter(c => c.status === 'pending').length,
        'Pagadas': group.commissions.filter(c => c.status === 'paid').length,
        'Total Pendiente': group.commissions
          .filter(c => c.status === 'pending')
          .reduce((sum, c) => sum + c.amount, 0),
        'Total Pagado': group.commissions
          .filter(c => c.status === 'paid')
          .reduce((sum, c) => sum + c.amount, 0),
        'Total General': group.commissions.reduce((sum, c) => sum + c.amount, 0)
      }));
      
      const operatorWs = XLSX.utils.json_to_sheet(operatorSummary);
      XLSX.utils.book_append_sheet(wb, operatorWs, 'Por Operador');
    }

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

const createFilterLabels = (filters: AppliedCommissionFilters): string[][] => {
  const labels: string[][] = [];
  
  if (filters.dateFrom && filters.dateTo) {
    labels.push(['Período:', `${filters.dateFrom} - ${filters.dateTo}`]);
  }
  
  if (filters.status && filters.status !== 'all') {
    const statusLabel = filters.status === 'pending' ? 'Pendientes' : 'Pagadas';
    labels.push(['Estado:', statusLabel]);
  }
  
  if (filters.operatorName) {
    labels.push(['Operador:', filters.operatorName]);
  }
  
  if (filters.clientName) {
    labels.push(['Cliente:', filters.clientName]);
  }
  
  if (filters.amountFrom !== undefined || filters.amountTo !== undefined) {
    const from = filters.amountFrom ? formatCurrency(filters.amountFrom) : 'Sin límite';
    const to = filters.amountTo ? formatCurrency(filters.amountTo) : 'Sin límite';
    labels.push(['Rango Monto:', `${from} - ${to}`]);
  }
  
  return labels;
};

const calculateCommissionSummary = (commissions: Commission[]) => {
  const pending = commissions.filter(c => c.status === 'pending');
  const paid = commissions.filter(c => c.status === 'paid');
  const total = commissions.reduce((sum, c) => sum + c.amount, 0);
  
  return {
    pendingCount: pending.length,
    paidCount: paid.length,
    totalPending: pending.reduce((sum, c) => sum + c.amount, 0),
    totalPaid: paid.reduce((sum, c) => sum + c.amount, 0),
    total,
    average: commissions.length > 0 ? total / commissions.length : 0
  };
};

const createExcelSummaryData = (
  commissions: Commission[], 
  company: Settings['company'], 
  filters: AppliedCommissionFilters
): any[][] => {
  const summary = calculateCommissionSummary(commissions);
  const filterLabels = createFilterLabels(filters);
  
  return [
    [company.name || 'Grúas 5 Norte'],
    [`RUT: ${company.taxId || 'N/A'}`],
    [company.address || ''],
    [`Tel: ${company.phone || 'N/A'} | Email: ${company.email || 'N/A'}`],
    [],
    ['Reporte de Comisiones'],
    [],
    ['Filtros Aplicados'],
    ...filterLabels,
    [],
    ['Resumen Ejecutivo'],
    ['Métrica', 'Valor'],
    ['Total Comisiones', commissions.length],
    ['Comisiones Pendientes', summary.pendingCount],
    ['Comisiones Pagadas', summary.paidCount],
    ['Total Pendiente', summary.totalPending],
    ['Total Pagado', summary.totalPaid],
    ['Total General', summary.total],
    ['Comisión Promedio', summary.average],
  ];
};

const groupCommissionsByOperator = (commissions: Commission[]) => {
  const groups = commissions.reduce((acc, commission) => {
    const operatorId = commission.operator_id;
    const operatorName = commission.operators?.name || 'Sin Operador';
    
    if (!acc[operatorId]) {
      acc[operatorId] = {
        operatorName,
        commissions: []
      };
    }
    
    acc[operatorId].commissions.push(commission);
    return acc;
  }, {} as Record<string, { operatorName: string; commissions: Commission[] }>);
  
  return Object.values(groups);
};
