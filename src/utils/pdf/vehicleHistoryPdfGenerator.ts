import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchCompanyData } from './companyDataFetcher';
import { VehicleFullHistoryEntry, VehicleFullHistorySummary } from '@/hooks/useVehicleFullHistory';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { formatCurrency } from '@/utils/statusHelpers';

const TMS_VIOLET = [139, 92, 246] as [number, number, number]; // violet-500
const LIGHT_GRAY = [245, 245, 245] as [number, number, number];
const DARK_TEXT = [30, 30, 30] as [number, number, number];

interface VehicleHistoryPDFData {
  history: VehicleFullHistoryEntry[];
  summary: VehicleFullHistorySummary;
}

const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    in_progress: 'En Proceso',
    completed: 'Completado',
    cancelled: 'Cancelado',
    invoiced: 'Facturado',
    liquidated: 'Liquidado',
  };
  return labels[status] || status;
};

const getInvoiceStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    draft: 'Borrador',
    sent: 'Enviada',
    paid: 'Pagada',
    overdue: 'Vencida',
    cancelled: 'Anulada',
  };
  return labels[status] || status;
};

export const generateVehicleHistoryPDF = async (data: VehicleHistoryPDFData): Promise<Blob> => {
  const doc = new jsPDF();
  const { history, summary } = data;
  const pageWidth = doc.internal.pageSize.width;
  
  // 1. Obtener datos de la empresa
  const companyData = await fetchCompanyData();
  
  let yPosition = 20;

  // 2. Agregar logo
  try {
    const logoBase64 = await loadImageAsBase64('/logo-gruas-5-norte.png');
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', 20, yPosition, 40, 25);
      yPosition += 30;
    }
  } catch (e) {
    console.warn('Could not load logo:', e);
  }

  // 3. Título del documento
  doc.setFontSize(18);
  doc.setTextColor(...TMS_VIOLET);
  doc.text('INFORME DE HISTORIAL DEL VEHÍCULO', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // 4. Información de la empresa
  doc.setFontSize(12);
  doc.setTextColor(...DARK_TEXT);
  doc.text(companyData.businessName, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 6;
  
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`RUT: ${companyData.rut} | Tel: ${companyData.phone} | ${companyData.email}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // 5. Línea separadora
  doc.setDrawColor(...TMS_VIOLET);
  doc.setLineWidth(0.5);
  doc.line(20, yPosition, pageWidth - 20, yPosition);
  yPosition += 10;

  // 6. Información del vehículo
  doc.setFontSize(14);
  doc.setTextColor(...TMS_VIOLET);
  doc.text('DATOS DEL VEHÍCULO', 20, yPosition);
  yPosition += 8;

  const vehicleData = [
    ['Patente:', summary.licensePlate],
    ['Marca:', summary.vehicleBrand || 'N/A'],
    ['Modelo:', summary.vehicleModel || 'N/A'],
    ['Primer Servicio:', summary.firstServiceDate ? formatForDisplay(summary.firstServiceDate) : 'N/A'],
    ['Último Servicio:', summary.lastServiceDate ? formatForDisplay(summary.lastServiceDate) : 'N/A'],
  ];

  autoTable(doc, {
    startY: yPosition,
    body: vehicleData,
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold', fillColor: LIGHT_GRAY },
      1: { cellWidth: 80 }
    },
    styles: { 
      fontSize: 9, 
      cellPadding: 3,
      textColor: DARK_TEXT
    },
    margin: { left: 20, right: 20 }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  // 7. Resumen de servicios
  doc.setFontSize(14);
  doc.setTextColor(...TMS_VIOLET);
  doc.text('RESUMEN', 20, yPosition);
  yPosition += 8;

  const summaryData = [
    ['Total de Servicios:', summary.totalServices.toString()],
    ['Valor Total:', formatCurrency(summary.totalValue)],
    ['Total Facturado:', formatCurrency(summary.totalInvoiced)],
    ['Con Cotización:', `${summary.servicesWithQuote} servicios`],
    ['Con Orden de Compra:', `${summary.servicesWithPO} servicios`],
    ['Con Factura:', `${summary.servicesWithInvoice} servicios`],
  ];

  autoTable(doc, {
    startY: yPosition,
    body: summaryData,
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', fillColor: LIGHT_GRAY },
      1: { cellWidth: 70, halign: 'right' }
    },
    styles: { 
      fontSize: 9, 
      cellPadding: 3,
      textColor: DARK_TEXT
    },
    margin: { left: 20, right: 20 }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // 8. Verificar si necesitamos nueva página para la tabla detallada
  if (yPosition > 200) {
    doc.addPage();
    yPosition = 20;
  }

  // 9. Tabla detallada de servicios
  doc.setFontSize(14);
  doc.setTextColor(...TMS_VIOLET);
  doc.text('DETALLE DE SERVICIOS', 20, yPosition);
  yPosition += 8;

  const tableHeaders = ['Fecha', 'Folio', 'Tipo', 'Cliente', 'OC', 'Factura', 'Valor', 'Estado'];
  
  const tableData = history.map(entry => [
    formatForDisplay(entry.serviceDate),
    entry.folio,
    entry.serviceType.name.length > 15 ? entry.serviceType.name.substring(0, 15) + '...' : entry.serviceType.name,
    entry.client.name.length > 20 ? entry.client.name.substring(0, 20) + '...' : entry.client.name,
    entry.purchaseOrderNumber || entry.purchaseOrder || '-',
    entry.invoice ? `${entry.invoice.folio}${entry.invoice.numeroFiscal ? '\n(N°' + entry.invoice.numeroFiscal + ')' : ''}` : '-',
    formatCurrency(entry.value),
    getStatusLabel(entry.status)
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [tableHeaders],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: TMS_VIOLET,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8
    },
    bodyStyles: {
      fontSize: 7,
      textColor: DARK_TEXT
    },
    columnStyles: {
      0: { cellWidth: 22 },  // Fecha
      1: { cellWidth: 22 },  // Folio
      2: { cellWidth: 28 },  // Tipo
      3: { cellWidth: 30 },  // Cliente
      4: { cellWidth: 20 },  // OC
      5: { cellWidth: 25 },  // Factura
      6: { cellWidth: 22, halign: 'right' },  // Valor
      7: { cellWidth: 20 },  // Estado
    },
    margin: { left: 15, right: 15 }
  });

  // 10. Footer con información de generación
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(128, 128, 128);
    
    const now = new Date();
    const timestamp = now.toLocaleString('es-CL');
    doc.text(`Documento generado: ${timestamp}`, 20, doc.internal.pageSize.height - 10);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 20, doc.internal.pageSize.height - 10, { align: 'right' });
  }
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(128, 128, 128);
    
    const now = new Date();
    const timestamp = now.toLocaleString('es-CL');
    doc.text(`Documento generado: ${timestamp}`, 20, doc.internal.pageSize.height - 10);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 20, doc.internal.pageSize.height - 10, { align: 'right' });
  }

  return doc.output('blob');
};

export const downloadVehicleHistoryPDF = async (data: VehicleHistoryPDFData): Promise<void> => {
  const blob = await generateVehicleHistoryPDF(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `historial-vehiculo-${data.summary.licensePlate}-${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
