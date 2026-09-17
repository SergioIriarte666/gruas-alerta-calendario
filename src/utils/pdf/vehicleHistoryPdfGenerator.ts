import { parseDateValue } from '@/utils/calendarDate';
import { businessClock } from '@/utils/businessClock';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchCompanyData } from './companyDataFetcher';
import { formatCurrency } from '@/utils/statusHelpers';
import { VehicleFullHistoryData, VehicleHistoryRecord } from '@/hooks/useVehicleFullHistory';
import {
  addReportFooter,
  addReportHeader,
  REPORT_PDF_COLORS,
} from './reportPdfTheme';

const TMS_GREEN = REPORT_PDF_COLORS.primary;
const WHITE = REPORT_PDF_COLORS.white;
const DARK_TEXT = REPORT_PDF_COLORS.ink;

const formatDate = (dateStr: string): string => {
  try {
    const date = parseDateValue(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    in_progress: 'En Progreso',
    completed: 'Completado',
    invoiced: 'Facturado',
    written_off: 'Castigado',
    cancelled: 'Cancelado',
    failed: 'Fallido',
    quoted: 'Cotizado',
    purchase_order_pending: 'OC Pendiente',
    with_purchase_order: 'Con OC',
    draft: 'Borrador',
    sent: 'Enviada',
    paid: 'Pagada',
    overdue: 'Vencida',
    partially_paid: 'Pago Parcial'
  };
  return labels[status] || status;
};

export const generateVehicleHistoryPDF = async (
  data: VehicleFullHistoryData
): Promise<Blob> => {
  // Usar orientación horizontal para mejor visualización
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  
  // 1. Obtener datos de la empresa
  const companyData = await fetchCompanyData();
  
  let yPosition = await addReportHeader(doc, {
    name: companyData.businessName,
    taxId: companyData.rut,
    address: companyData.address,
    phone: companyData.phone,
    email: companyData.email,
    logo: companyData.logoUrl,
  });

  // Título centrado
  doc.setFontSize(14);
  doc.setTextColor(...DARK_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.text('Historial completo del vehículo', margin, yPosition);
  yPosition += 7;

  // Línea separadora
  doc.setDrawColor(...TMS_GREEN);
  doc.setLineWidth(0.8);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  // ============ INFORMACIÓN DEL VEHÍCULO Y RESUMEN EN 2 COLUMNAS ============
  const colWidth = (pageWidth - margin * 3) / 2;
  
  // Columna izquierda: Datos del vehículo
  doc.setFontSize(11);
  doc.setTextColor(...TMS_GREEN);
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL VEHÍCULO', margin, yPosition);
  
  // Columna derecha: Resumen
  doc.text('RESUMEN', margin + colWidth + margin, yPosition);
  yPosition += 5;

  // Tabla de vehículo (columna izquierda)
  const vehicleInfo = [
    ['Patente:', data.licensePlate.toUpperCase()],
    ['Marca:', data.vehicleBrand || 'No especificada'],
    ['Modelo:', data.vehicleModel || 'No especificado']
  ];

  autoTable(doc, {
    startY: yPosition,
    body: vehicleInfo,
    theme: 'plain',
    tableWidth: colWidth,
    columnStyles: {
      0: { cellWidth: 25, fontStyle: 'bold', textColor: DARK_TEXT },
      1: { cellWidth: colWidth - 25, textColor: DARK_TEXT }
    },
    styles: { fontSize: 9, cellPadding: 2 },
    margin: { left: margin }
  });

  // Tabla de resumen (columna derecha)
  const summaryData = [
    ['Total Servicios:', String(data.summary.totalServices)],
    ['Completados:', String(data.summary.completedServices)],
    ['Cancelados:', String(data.summary.cancelledServices)],
    ['Cotizaciones:', String(data.summary.totalQuotes)],
    ['Órdenes de Compra:', String(data.summary.totalPurchaseOrders)],
    ['Facturas:', String(data.summary.totalInvoices)],
    ['VALOR TOTAL:', formatCurrency(data.summary.totalValue)]
  ];

  autoTable(doc, {
    startY: yPosition,
    body: summaryData,
    theme: 'plain',
    tableWidth: colWidth,
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold', textColor: DARK_TEXT },
      1: { cellWidth: colWidth - 40, halign: 'right', textColor: DARK_TEXT }
    },
    styles: { fontSize: 9, cellPadding: 2 },
    margin: { left: margin + colWidth + margin },
    didParseCell: (hookData) => {
      // Destacar el valor total
      if (hookData.row.index === summaryData.length - 1) {
        hookData.cell.styles.fillColor = TMS_GREEN;
        hookData.cell.styles.textColor = WHITE;
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fontSize = 10;
      }
    }
  });

  yPosition = Math.max(
    (doc as any).lastAutoTable?.finalY || yPosition + 30,
    yPosition + 35
  );
  yPosition += 10;

  // ============ HISTORIAL DE SERVICIOS ============
  doc.setFontSize(11);
  doc.setTextColor(...TMS_GREEN);
  doc.setFont('helvetica', 'bold');
  doc.text('HISTORIAL DE SERVICIOS', margin, yPosition);
  yPosition += 5;

  if (data.services.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'italic');
    doc.text('No se encontraron registros para este vehículo.', margin, yPosition + 5);
  } else {
    // Preparar datos - cada servicio con su info de factura en la misma fila
    const tableData = data.services.map((service: VehicleHistoryRecord) => {
      // Construir columna de COT/OC (sin duplicar prefijos)
      let cotOc = '-';
      if (service.quoteNumber && service.purchaseOrder) {
        cotOc = `${service.quoteNumber} / ${service.purchaseOrder}`;
      } else if (service.quoteNumber) {
        cotOc = service.quoteNumber;
      } else if (service.purchaseOrder) {
        cotOc = service.purchaseOrder;
      }
      
      // Construir columna de factura - solo número fiscal
      let factura = 'Sin factura';
      if (service.relatedInvoice) {
        factura = service.relatedInvoice.numeroFiscal || service.relatedInvoice.folio || 'Pendiente';
      }
      
      return [
        formatDate(service.date),
        service.folio,
        service.relatedInvoice?.numeroFiscal || '-',
        service.serviceTypeName || '-',
        getStatusLabel(service.status),
        service.clientName.length > 30 ? service.clientName.substring(0, 30) + '...' : service.clientName,
        formatCurrency(service.value),
        cotOc,
        factura
      ];
    });

    autoTable(doc, {
      startY: yPosition,
      head: [['Fecha', 'Folio', 'N° Fiscal', 'Tipo Servicio', 'Estado', 'Cliente', 'Valor', 'COT / OC', 'Factura']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: TMS_GREEN,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
        cellPadding: 3
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: DARK_TEXT
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center' },    // Fecha
        1: { cellWidth: 20, halign: 'left' },      // Folio
        2: { cellWidth: 20, halign: 'left' },      // N° Fiscal
        3: { cellWidth: 'auto', halign: 'left' },  // Tipo Servicio - auto para expandir
        4: { cellWidth: 20, halign: 'center' },    // Estado
        5: { cellWidth: 40, halign: 'left' },      // Cliente
        6: { cellWidth: 22, halign: 'right' },     // Valor
        7: { cellWidth: 30, halign: 'left' },      // COT / OC
        8: { cellWidth: 22, halign: 'left' }       // Factura
      },
      margin: { left: margin, right: margin },
    });
  }

  // ============ NOTAS FINALES ============
  const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 20;
  
  if (finalY < pageHeight - 25) {
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'italic');
    doc.text(
      'Este documento es un informe generado automáticamente. Para consultas: ' + companyData.email,
      pageWidth / 2,
      finalY + 8,
      { align: 'center' }
    );
  }

  addReportFooter(doc, {
    leftLines: [`Patente: ${data.licensePlate.toUpperCase()}`],
    generatedAt: businessClock.format(businessClock.now(), 'dd/MM/yyyy HH:mm'),
  });
  return doc.output('blob');
};
