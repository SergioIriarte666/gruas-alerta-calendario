import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createLogger } from "@/lib/logger";
import { REPORT_PDF_COLORS } from '../reportPdfTheme';
import type { EquipmentItem } from '@/services/inspectionEquipmentCatalog';


const logger = createLogger("equipmentChecklist");
const C = {
  green:     REPORT_PDF_COLORS.primary,
  grayLight: REPORT_PDF_COLORS.soft,
  white:     REPORT_PDF_COLORS.white,
  black:     [20, 20, 20]    as [number, number, number],
};
const MARGIN = 14;

/**
 * Checklist resuelto para el acta: la lista de ítems que se evaluaron y el
 * estado de cada uno. Nunca una lista fija en el código — el catálogo vive en
 * inspection_equipment_items y crece.
 */
export interface ResolvedEquipmentChecklist {
  items: Array<{ id: string; name: string }>;
  /** {item_id: presente}. Un ítem evaluado y ausente es `false`, no una ausencia de llave. */
  status: Record<string, boolean>;
  /**
   * false para inspecciones anteriores a inspections.equipment_status: sabemos
   * qué estaba presente, pero no cuántos ítems se evaluaron realmente. El acta
   * lo dice en vez de inventar un total.
   */
  hasExplicitStatus: boolean;
}

/**
 * Resuelve el checklist a imprimir.
 *
 * Con equipment_status disponible se usa esa llave-a-llave: congela el catálogo
 * vigente al momento de inspeccionar, así que un ítem agregado o desactivado
 * después no altera un acta histórica. Sin él (inspecciones antiguas) se cae al
 * catálogo activo de hoy con los presentes marcados.
 */
export const resolveEquipmentChecklist = (
  catalog: EquipmentItem[],
  equipmentStatus: Record<string, boolean> | undefined,
  selectedEquipment: string[] | undefined,
): ResolvedEquipmentChecklist => {
  const nameById = new Map(catalog.map((item) => [String(item.id), item.name]));

  if (equipmentStatus && Object.keys(equipmentStatus).length > 0) {
    const statusIds = new Set(Object.keys(equipmentStatus));
    // Orden del catálogo primero; los ítems que existían al inspeccionar pero ya
    // no están en el catálogo se agregan al final para no perderlos del acta.
    const ordered = catalog
      .map((item) => String(item.id))
      .filter((id) => statusIds.has(id));
    const orphans = [...statusIds].filter((id) => !nameById.has(id));

    return {
      items: [...ordered, ...orphans].map((id) => ({ id, name: nameById.get(id) ?? id })),
      status: equipmentStatus,
      hasExplicitStatus: true,
    };
  }

  const activeItems = catalog.filter((item) => item.is_active);
  const selected = new Set((selectedEquipment || []).map(String));

  return {
    items: activeItems.map((item) => ({ id: String(item.id), name: item.name })),
    status: Object.fromEntries(activeItems.map((item) => [String(item.id), selected.has(String(item.id))])),
    hasExplicitStatus: false,
  };
};

export const addEquipmentChecklist = (
  doc: jsPDF,
  checklist: ResolvedEquipmentChecklist,
  yPosition: number,
): number => {
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

    const allItems = checklist.items;

    if (allItems.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(200, 50, 50);
      doc.text('Error: No se pudo cargar el inventario de equipos', MARGIN, yPosition);
      return yPosition + 20;
    }

    const equipmentTableData = allItems.map((item) => [
      item.name,
      checklist.status[item.id] ? 'SI' : 'NO',
    ]);

    // El layout de 3 columnas fluye con N ítems: nunca asumir un total fijo.
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
        fillColor: REPORT_PDF_COLORS.primary,
        textColor: REPORT_PDF_COLORS.white,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
      },
      alternateRowStyles: { fillColor: REPORT_PDF_COLORS.soft },
      didParseCell: (hookData) => {
        if ([1, 3, 5].includes(hookData.column.index) && hookData.section === 'body') {
          const val = String(hookData.cell.text[0] || '').toUpperCase();
          if (val === 'SI') {
            hookData.cell.styles.textColor = REPORT_PDF_COLORS.primaryDark;
          } else if (val === 'NO') {
            hookData.cell.styles.textColor = [180, 50, 50];
          }
        }
      },
      margin: { left: MARGIN, right: MARGIN },
    });

    const finalY = (doc as any).lastAutoTable.finalY;
    const totalCount = allItems.length;
    const presentCount = allItems.filter((item) => checklist.status[item.id]).length;
    const absentCount = totalCount - presentCount;

    // Sin barra de progreso ni porcentaje: "27 de 35 · 77% completado" se leía
    // como inspección incompleta cuando en realidad se evaluaron los 36 ítems y
    // 9 estaban ausentes. El rótulo ahora separa verificados de presentes.
    const summary = checklist.hasExplicitStatus
      ? `Elementos verificados: ${totalCount} de ${totalCount} · Presentes: ${presentCount} · Ausentes: ${absentCount}`
      : `Elementos presentes: ${presentCount} de ${totalCount} · Inspección anterior al registro de ausencias`;

    const summaryY = finalY + 8;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...REPORT_PDF_COLORS.primaryDark);
    doc.text(summary, MARGIN, summaryY);

    return summaryY + 10;
  } catch (error) {
    logger.error('Error en addEquipmentChecklist:', error);
    return yPosition + 50;
  }
};
