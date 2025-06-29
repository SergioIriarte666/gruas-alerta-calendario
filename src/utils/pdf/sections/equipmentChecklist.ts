
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InspectionPDFData } from '../pdfTypes';
import { vehicleEquipment } from '@/data/equipmentData';

export const addEquipmentChecklist = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  try {
    // Verificar si necesitamos una nueva página
    if (yPosition > 200) {
      doc.addPage();
      yPosition = 20;
    }

    // Título de la sección
    doc.setFontSize(12);
    doc.setTextColor(0, 150, 136);
    doc.text('INVENTARIO DE EQUIPOS Y ACCESORIOS', 20, yPosition);
    yPosition += 8;

    // Validar que vehicleEquipment existe y tiene datos
    if (!vehicleEquipment || !Array.isArray(vehicleEquipment) || vehicleEquipment.length === 0) {
      console.error('vehicleEquipment no está disponible o está vacío');
      doc.setFontSize(10);
      doc.setTextColor(200, 50, 50);
      doc.text('Error: No se pudo cargar el inventario de equipos', 20, yPosition);
      return yPosition + 20;
    }

    // Obtener items de la primera categoría (Inspección del Vehículo)
    const firstCategory = vehicleEquipment[0];
    if (!firstCategory || !firstCategory.items || !Array.isArray(firstCategory.items)) {
      console.error('La primera categoría no tiene items válidos');
      doc.setFontSize(10);
      doc.setTextColor(200, 50, 50);
      doc.text('Error: No hay elementos en la categoría de inspección', 20, yPosition);
      return yPosition + 20;
    }

    const allItems = firstCategory.items;
    const selectedEquipment = data.inspection.equipment || [];
    
    console.log('Equipos seleccionados:', selectedEquipment);
    console.log('Total de elementos en inventario:', allItems.length);

    // Crear tabla con todos los elementos y su estado usando texto simple compatible con PDF
    const equipmentTableData = allItems.map(item => {
      const itemId = String(item.id);
      const isSelected = selectedEquipment.some(selectedId => String(selectedId) === itemId);
      // Usar texto simple que funciona en PDF
      const statusText = isSelected ? 'SI' : 'NO';
      return [item.name, statusText];
    });

    // Dividir en 3 columnas para mejor presentación
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
      theme: 'striped',
      columnStyles: {
        0: { cellWidth: 45, fontSize: 8 },
        1: { 
          cellWidth: 15, 
          halign: 'center', 
          fontSize: 10,
          fontStyle: 'bold'
        },
        2: { cellWidth: 45, fontSize: 8 },
        3: { 
          cellWidth: 15, 
          halign: 'center', 
          fontSize: 10,
          fontStyle: 'bold'
        },
        4: { cellWidth: 45, fontSize: 8 },
        5: { 
          cellWidth: 15, 
          halign: 'center', 
          fontSize: 10,
          fontStyle: 'bold'
        }
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: [0, 0, 0],
        overflow: 'linebreak',
        minCellHeight: 8
      },
      headStyles: {
        fillColor: [0, 150, 136],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      // Personalizar colores para SI/NO
      didParseCell: function(data) {
        // Solo aplicar colores especiales a las columnas de estado (1, 3, 5)
        if ([1, 3, 5].includes(data.column.index) && data.cell.text.length > 0) {
          const statusText = data.cell.text[0];
          if (statusText === 'SI') {
            data.cell.styles.textColor = [0, 150, 0]; // Verde intenso para SI
            data.cell.styles.fontStyle = 'bold';
          } else if (statusText === 'NO') {
            data.cell.styles.textColor = [200, 50, 50]; // Rojo para NO
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      margin: { left: 20, right: 20 },
      tableWidth: 'auto'
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;

    // Resumen de elementos seleccionados con mejor formato
    const selectedCount = selectedEquipment.length;
    const totalCount = allItems.length;
    
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Elementos verificados: ${selectedCount} de ${totalCount}`, 20, yPosition);
    
    // Agregar porcentaje de completitud
    const completionPercentage = Math.round((selectedCount / totalCount) * 100);
    doc.text(`Porcentaje de completitud: ${completionPercentage}%`, 20, yPosition + 6);
    yPosition += 20;

    console.log('Checklist de equipos agregado correctamente');
    return yPosition;
  } catch (error) {
    console.error('Error en addEquipmentChecklist:', error);
    return yPosition + 50;
  }
};
