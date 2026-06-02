import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InspectionPDFData } from '../pdfTypes';
import { vehicleEquipment } from '@/data/equipmentData';
import { createLogger } from "@/lib/logger";


const logger = createLogger("equipmentChecklist");
const C = {
  green:     [0, 130, 100]   as [number, number, number],
  grayLight: [248, 252, 250] as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
  black:     [20, 20, 20]    as [number, number, number],
};
const MARGIN = 14;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

export const addEquipmentChecklist = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  try {
    if (yPosition > 200) {
      doc.addPage();
      yPosition = 20;
    }

    // Encabezado de sección con barra de acento verde
    doc.setFillColor(...C.green);
    doc.rect(MARGIN, yPosition, 6, 10, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.green);
    doc.text('INVENTARIO DE EQUIPOS Y ACCESORIOS', MARGIN + 10, yPosition + 7);
    yPosition += 14;

    if (!vehicleEquipment || !Array.isArray(vehicleEquipment) || vehicleEquipment.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(200, 50, 50);
      doc.text('Error: No se pudo cargar el inventario de equipos', MARGIN, yPosition);
      return yPosition + 20;
    }

    const firstCategory = vehicleEquipment[0];
    if (!firstCategory?.items || !Array.isArray(firstCategory.items)) {
      doc.setFontSize(10);
      doc.setTextColor(200, 50, 50);
      doc.text('Error: No hay elementos en la categoría de inspección', MARGIN, yPosition);
      return yPosition + 20;
    }

    const allItems = firstCategory.items;
    const selectedEquipment = data.inspection.equipment || [];

    const equipmentTableData = allItems.map(item => {
      const isSelected = selectedEquipment.some(id => String(id) === String(item.id));
      return [item.name, isSelected ? 'SI' : 'NO'];
    });

    const itemsPerColumn = Math.ceil(equipmentTableData.length / 3);
    const tableRows: Array<[string, string, string, string, string, string]> = [];

    for (let i = 0; i < itemsPerColumn; i++) {
      const col1 = equipmentTableData[i] || ['', ''];
      const col2 = equipmentTableData[i + itemsPerColumn] || ['', ''];
      const col3 = equipmentTableData[i + itemsPerColumn * 2] || ['', ''];
      tableRows.push([col1[0], col1[1], col2[0], col2[1], col3[0], col3[1]]);
    }

    autoTable(doc, {
      startY: yPosition,
      head: [['Elemento', 'Estado', 'Elemento', 'Estado', 'Elemento', 'Estado']],
      body: tableRows,
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 43, fontSize: 8 },
        1: { cellWidth: 13, halign: 'center', fontSize: 8.5, fontStyle: 'bold' },
        2: { cellWidth: 43, fontSize: 8 },
        3: { cellWidth: 13, halign: 'center', fontSize: 8.5, fontStyle: 'bold' },
        4: { cellWidth: 43, fontSize: 8 },
        5: { cellWidth: 13, halign: 'center', fontSize: 8.5, fontStyle: 'bold' },
      },
      styles: { cellPadding: 2.5, textColor: [20, 20, 20] },
      headStyles: {
        fillColor: [0, 130, 100],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
      },
      alternateRowStyles: { fillColor: [248, 252, 250] },
      didParseCell: (hookData) => {
        if ([1, 3, 5].includes(hookData.column.index) && hookData.section === 'body') {
          const val = String(hookData.cell.text[0] || '').toUpperCase();
          if (val === 'SI') {
            hookData.cell.styles.textColor = [0, 130, 100];
          } else if (val === 'NO') {
            hookData.cell.styles.textColor = [180, 50, 50];
          }
        }
      },
      margin: { left: MARGIN, right: MARGIN },
    });

    const finalY = (doc as any).lastAutoTable.finalY;
    const selectedCount = selectedEquipment.length;
    const totalCount = allItems.length;
    const pct = Math.round((selectedCount / totalCount) * 100);

    // Barra de progreso de completitud
    const barX = MARGIN;
    const barY = finalY + 5;
    const barW = CONTENT_W;
    const barH = 5;

    doc.setFillColor(220, 220, 220);
    doc.roundedRect(barX, barY, barW, barH, 2, 2, 'F');
    doc.setFillColor(0, 130, 100);
    doc.roundedRect(barX, barY, barW * (pct / 100), barH, 2, 2, 'F');

    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    doc.text(`Elementos verificados: ${selectedCount} de ${totalCount}`, MARGIN, barY + 11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 130, 100);
    doc.text(`${pct}% completado`, PAGE_W - MARGIN, barY + 11, { align: 'right' });

    yPosition = barY + 18;
    return yPosition;
  } catch (error) {
    logger.error('Error en addEquipmentChecklist:', error);
    return yPosition + 50;
  }
};
