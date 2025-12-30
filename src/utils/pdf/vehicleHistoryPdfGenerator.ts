import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchCompanyData } from './companyDataFetcher';
import { formatCurrency } from '@/utils/statusHelpers';
import { VehicleFullHistoryData, VehicleHistoryRecord } from '@/hooks/useVehicleFullHistory';

const TMS_GREEN = [0, 150, 136] as [number, number, number];
const LIGHT_GRAY = [245, 245, 245] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];

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

const getTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    service: 'Servicio',
    quote: 'Cotización',
    purchase_order: 'Orden Compra',
    invoice: 'Factura'
  };
  return labels[type] || type;
};

export const generateVehicleHistoryPDF = async (
  data: VehicleFullHistoryData
): Promise<Blob> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // 1. Obtener datos de la empresa
  const companyData = await fetchCompanyData();
  
  let yPosition = 15;

  // 2. Header con logo
  try {
    const logoBase64 = await loadImageAsBase64('/logo-gruas-5-norte.png');
    if (logoBase64) {
      const { width: origW, height: origH } = await getImageDimensions(logoBase64);
      const maxW = 45, maxH = 25;
      const ratio = origW / origH;
      let logoW = maxW, logoH = maxW / ratio;
      if (logoH > maxH) { logoH = maxH; logoW = maxH * ratio; }
      doc.addImage(logoBase64, 'PNG', 15, yPosition, logoW, logoH);
      yPosition += Math.max(logoH + 5, 20);
    }
  } catch (e) {
    console.warn('No se pudo cargar el logo:', e);
  }

  // 3. Título del documento
  doc.setFontSize(18);
  doc.setTextColor(...TMS_GREEN);
  doc.text('HISTORIAL COMPLETO DEL VEHÍCULO', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // 4. Información de la empresa
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(companyData.businessName, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 6;
  
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`RUT: ${companyData.rut} | Tel: ${companyData.phone}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 5;
  doc.text(companyData.address, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // 5. Línea separadora
  doc.setDrawColor(...TMS_GREEN);
  doc.setLineWidth(0.8);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 12;

  // 6. Información del vehículo
  doc.setFontSize(12);
  doc.setTextColor(...TMS_GREEN);
  doc.text('DATOS DEL VEHÍCULO', 15, yPosition);
  yPosition += 7;

  const vehicleInfo = [
    ['Patente:', data.licensePlate.toUpperCase()],
    ['Marca:', data.vehicleBrand || 'No especificada'],
    ['Modelo:', data.vehicleModel || 'No especificado']
  ];

  autoTable(doc, {
    startY: yPosition,
    body: vehicleInfo,
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 35, fontStyle: 'bold', fillColor: LIGHT_GRAY },
      1: { cellWidth: 60 }
    },
    styles: { fontSize: 9, cellPadding: 3, textColor: [0, 0, 0] },
    margin: { left: 15, right: 15 }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 12;

  // 7. Resumen
  doc.setFontSize(12);
  doc.setTextColor(...TMS_GREEN);
  doc.text('RESUMEN', 15, yPosition);
  yPosition += 7;

  const summaryData = [
    ['Total Servicios:', String(data.summary.totalServices)],
    ['Servicios Completados:', String(data.summary.completedServices)],
    ['Servicios Cancelados:', String(data.summary.cancelledServices)],
    ['Cotizaciones:', String(data.summary.totalQuotes)],
    ['Órdenes de Compra:', String(data.summary.totalPurchaseOrders)],
    ['Facturas Emitidas:', String(data.summary.totalInvoices)],
    ['Valor Total Acumulado:', formatCurrency(data.summary.totalValue)]
  ];

  autoTable(doc, {
    startY: yPosition,
    body: summaryData,
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold', fillColor: LIGHT_GRAY },
      1: { cellWidth: 40, halign: 'right' }
    },
    styles: { fontSize: 9, cellPadding: 3, textColor: [0, 0, 0] },
    margin: { left: 15, right: 15 },
    didParseCell: (hookData) => {
      // Destacar el valor total
      if (hookData.row.index === summaryData.length - 1) {
        hookData.cell.styles.fillColor = TMS_GREEN;
        hookData.cell.styles.textColor = WHITE;
        hookData.cell.styles.fontStyle = 'bold';
      }
    }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // 8. Verificar si necesitamos nueva página para el historial
  if (yPosition > 200) {
    doc.addPage();
    yPosition = 20;
  }

  // 9. Historial detallado
  doc.setFontSize(12);
  doc.setTextColor(...TMS_GREEN);
  doc.text('HISTORIAL DETALLADO', 15, yPosition);
  yPosition += 7;

  if (data.records.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('No se encontraron registros para este vehículo.', 15, yPosition);
    yPosition += 10;
  } else {
    // Tabla con el historial
    const tableData = data.records.map((record: VehicleHistoryRecord) => [
      formatDate(record.date),
      getTypeLabel(record.type),
      record.folio,
      record.type === 'service' ? (record.serviceTypeName || '-') : '-',
      getStatusLabel(record.status),
      record.clientName,
      formatCurrency(record.value),
      record.quoteNumber || record.purchaseOrder || record.invoiceNumeroFiscal || '-'
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Fecha', 'Tipo', 'Folio', 'Servicio', 'Estado', 'Cliente', 'Valor', 'Ref.']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: TMS_GREEN,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 8
      },
      styles: { 
        fontSize: 7, 
        cellPadding: 2,
        overflow: 'ellipsize'
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 18 },
        2: { cellWidth: 22 },
        3: { cellWidth: 28 },
        4: { cellWidth: 22 },
        5: { cellWidth: 30 },
        6: { cellWidth: 22, halign: 'right' },
        7: { cellWidth: 18 }
      },
      margin: { left: 15, right: 15 },
      didDrawPage: (hookData) => {
        // Footer en cada página
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Página ${hookData.pageNumber} de ${pageCount}`,
          pageWidth - 25,
          doc.internal.pageSize.height - 10
        );
        doc.text(
          `Generado: ${new Date().toLocaleString('es-CL')}`,
          15,
          doc.internal.pageSize.height - 10
        );
      }
    });
  }

  // 10. Notas finales
  const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 20;
  
  if (finalY < 260) {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      'Este documento es un informe generado automáticamente por el sistema TMS.',
      pageWidth / 2,
      finalY + 15,
      { align: 'center' }
    );
    doc.text(
      'Para consultas: ' + companyData.email,
      pageWidth / 2,
      finalY + 20,
      { align: 'center' }
    );
  }

  return doc.output('blob');
};
