import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InspectionPDFData } from '../pdfTypes';
import { formatVehicleInfo, shouldShowVehicleInfo } from '@/utils/statusHelpers';
import { formatBusinessDateLong } from '@/utils/timezoneUtils';
import { formatShortAddress } from '@/utils/addressFormat';
import { normalizeLicensePlate } from '@/utils/licensePlate';
import { createLogger } from "@/lib/logger";
import { REPORT_PDF_COLORS } from '../reportPdfTheme';


const logger = createLogger("serviceInfo");
const C = {
  green:      REPORT_PDF_COLORS.primary,
  greenLight: REPORT_PDF_COLORS.total,
  grayLight:  REPORT_PDF_COLORS.soft,
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
    // Defensa en profundidad: filas anteriores al saneamiento todavía traen
    // patentes con espacio final ('TZSR-94 ') y no deben imprimirse así.
    const patente = shouldShowVehicleInfo(data.service)
      ? normalizeLicensePlate(data.service.licensePlate) || 'S/P'
      : 'S/P';

    const leftData = [
      ['Cliente', data.service.client?.name || 'N/A'],
      ['Fecha de servicio', formatBusinessDateLong(data.service.serviceDate)],
      // Dirección corta: la cadena geocodificada completa arrastra código postal
      // y país ("…, 2571126 Viña del Mar, Valparaíso, Chile") y desborda la celda.
      ['Origen', formatShortAddress(data.service.origin) || 'N/A'],
      ['Destino', formatShortAddress(data.service.destination) || 'N/A'],
      ['Grúa asignada', data.service.crane?.licensePlate || 'N/A'],
      ['Operador', data.service.operator?.name || 'N/A'],
    ];

    // En servicios in-situ (una sola fase, sin recogida/entrega) los campos
    // de kilometraje, combustible, llaves y documentación no se solicitan
    // en el formulario, por lo que mostrarlos en el PDF con valores fallback
    // ("N/A", "No presentes", "Incompleta") es ruido. Se omiten.
    const isInSitu = data.isInSitu ?? false;

    const rightData: string[][] = [
      ['Vehículo', vehiculo],
      ['Patente', patente],
    ];

    if (!isInSitu) {
      rightData.push(
        ['Kilometraje', data.inspection.kilometraje ? `${Number(data.inspection.kilometraje).toLocaleString('es-CL')} km` : 'N/A'],
        ['Combustible', combustibleMap[data.inspection.combustible || ''] || data.inspection.combustible || 'N/A'],
        ['Llaves', data.inspection.llaves === 'si' ? 'Presentes' : 'No presentes'],
        ['Documentación', data.inspection.documentacion === 'si' ? 'Completa' : 'Incompleta'],
      );
    }

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
      alternateRowStyles: { fillColor: REPORT_PDF_COLORS.soft },
      margin: { left: MARGIN },
    });
    const leftTableFinalY = (doc as any).lastAutoTable.finalY;

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
      alternateRowStyles: { fillColor: REPORT_PDF_COLORS.soft },
      margin: { left: MARGIN + colW + 4 },
    });
    const rightTableFinalY = (doc as any).lastAutoTable.finalY;

    yPosition = Math.max(leftTableFinalY, rightTableFinalY) + 12;
    return yPosition;
  } catch (error) {
    logger.error('Error en addServiceInfo:', error);
    return yPosition + 50;
  }
};
