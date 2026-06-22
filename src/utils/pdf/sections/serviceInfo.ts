import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InspectionPDFData } from '../pdfTypes';
import { formatVehicleInfo, shouldShowVehicleInfo } from '@/utils/statusHelpers';
import { formatBusinessDateLong } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("serviceInfo");
const C = {
  green:      [0, 130, 100]   as [number, number, number],
  greenLight: [230, 248, 244] as [number, number, number],
  grayLight:  [248, 248, 248] as [number, number, number],
  black:      [20, 20, 20]    as [number, number, number],
};
const MARGIN = 14;
const PAGE_W = 210;

export const addServiceInfo = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  try {
    // Encabezado de sección con barra de acento verde
    doc.setFillColor(...C.green);
    doc.rect(MARGIN, yPosition, 6, 10, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.green);
    doc.text('INFORMACIÓN DEL SERVICIO', MARGIN + 10, yPosition + 7);
    yPosition += 14;

    const combustibleMap: Record<string, string> = {
      '0': 'Vacío (0%)', '1/4': '1/4 (25%)', '1/2': '1/2 (50%)',
      '3/4': '3/4 (75%)', 'full': 'Lleno (100%)',
    };

    const vehiculo = formatVehicleInfo(data.service);
    const patente = shouldShowVehicleInfo(data.service) ? data.service.licensePlate || 'S/P' : 'S/P';

    const leftData = [
      ['Cliente', data.service.client?.name || 'N/A'],
      ['Fecha de servicio', formatBusinessDateLong(data.service.serviceDate)],
      ['Origen', data.service.origin || 'N/A'],
      ['Destino', data.service.destination || 'N/A'],
      ['Grúa asignada', data.service.crane?.licensePlate || 'N/A'],
      ['Operador', data.service.operator?.name || 'N/A'],
    ];

    const rightData = [
      ['Vehículo', vehiculo],
      ['Patente', patente],
      ['Kilometraje', data.inspection.kilometraje ? `${Number(data.inspection.kilometraje).toLocaleString('es-CL')} km` : 'N/A'],
      ['Combustible', combustibleMap[data.inspection.combustible || ''] || data.inspection.combustible || 'N/A'],
      ['Llaves', data.inspection.llaves === 'si' ? 'Presentes' : 'No presentes'],
      ['Documentación', data.inspection.documentacion === 'si' ? 'Completa' : 'Incompleta'],
    ];

    const colW = (PAGE_W - MARGIN * 2 - 4) / 2;

    autoTable(doc, {
      startY: yPosition,
      head: [],
      body: leftData,
      theme: 'plain',
      tableWidth: colW,
      columnStyles: {
        0: { cellWidth: 38, fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] },
        1: { cellWidth: colW - 38, fontSize: 8.5, textColor: [20, 20, 20] },
      },
      styles: { cellPadding: { top: 3, bottom: 3, left: 4, right: 4 } },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      margin: { left: MARGIN },
    });

    autoTable(doc, {
      startY: yPosition,
      head: [],
      body: rightData,
      theme: 'plain',
      tableWidth: colW,
      columnStyles: {
        0: { cellWidth: 32, fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] },
        1: { cellWidth: colW - 32, fontSize: 8.5, textColor: [20, 20, 20] },
      },
      styles: { cellPadding: { top: 3, bottom: 3, left: 4, right: 4 } },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      margin: { left: MARGIN + colW + 4 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 12;
    return yPosition;
  } catch (error) {
    logger.error('Error en addServiceInfo:', error);
    return yPosition + 50;
  }
};
