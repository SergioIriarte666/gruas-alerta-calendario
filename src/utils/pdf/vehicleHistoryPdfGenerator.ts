import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchCompanyData } from './companyDataFetcher';
import { formatCurrency } from '@/utils/statusHelpers';
import { VehicleFullHistoryData, VehicleHistoryRecord } from '@/hooks/useVehicleFullHistory';

const TMS_GREEN = [0, 150, 136] as [number, number, number];
const LIGHT_GRAY = [245, 245, 245] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];
const DARK_TEXT = [33, 33, 33] as [number, number, number];

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

const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 100, height: 50 });
    img.src = base64;
  });
};

const formatDate = (dateStr: string): string => {
  try {
    return new Date(dateStr).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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
  
  let yPosition = margin;

  // ============ HEADER ============
  // Logo a la izquierda
  try {
    const logoBase64 = await loadImageAsBase64('/logo-gruas-5-norte.png');
    if (logoBase64) {
      const { width: origW, height: origH } = await getImageDimensions(logoBase64);
      const maxH = 18;
      const ratio = origW / origH;
      const logoH = maxH;
      const logoW = maxH * ratio;
      doc.addImage(logoBase64, 'PNG', margin, yPosition, logoW, logoH);
    }
  } catch (e) {
    console.warn('No se pudo cargar el logo:', e);
  }

  // Título centrado
  doc.setFontSize(16);
  doc.setTextColor(...TMS_GREEN);
  doc.setFont('helvetica', 'bold');
  doc.text('HISTORIAL COMPLETO DEL VEHÍCULO', pageWidth / 2, yPosition + 8, { align: 'center' });
  
  // Datos empresa a la derecha
  doc.setFontSize(8);
  doc.setTextColor(...DARK_TEXT);
  doc.setFont('helvetica', 'normal');
  doc.text(companyData.businessName, pageWidth - margin, yPosition + 3, { align: 'right' });
  doc.text(`RUT: ${companyData.rut}`, pageWidth - margin, yPosition + 7, { align: 'right' });
  doc.text(`Tel: ${companyData.phone}`, pageWidth - margin, yPosition + 11, { align: 'right' });
  doc.text(companyData.email, pageWidth - margin, yPosition + 15, { align: 'right' });
  
  yPosition += 22;

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
        factura = service.relatedInvoice.numeroFiscal || 'Pendiente';
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
      didDrawPage: (hookData) => {
        // Footer en cada página
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(128, 128, 128);
        doc.setFont('helvetica', 'normal');
        
        // Número de página
        doc.text(
          `Página ${hookData.pageNumber} de ${pageCount}`,
          pageWidth - margin,
          pageHeight - 8,
          { align: 'right' }
        );
        
        // Fecha de generación
        doc.text(
          `Generado: ${new Date().toLocaleString('es-CL')}`,
          margin,
          pageHeight - 8
        );
        
        // Patente centrada
        doc.text(
          `Patente: ${data.licensePlate.toUpperCase()}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        );
      }
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

  return doc.output('blob');
};
