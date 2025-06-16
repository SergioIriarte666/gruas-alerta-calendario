
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { InspectionPDFData } from './pdfTypes';
import { vehicleEquipment } from '@/data/equipmentData';

export const addServiceInfo = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  try {
    const pageWidth = doc.internal.pageSize.width;
    
    // Título de la sección
    doc.setFontSize(12);
    doc.setTextColor(0, 150, 136);
    doc.text('INFORMACIÓN DEL SERVICIO', 20, yPosition);
    yPosition += 8;

    // Crear tabla con información del servicio
    const serviceData = [
      ['Folio:', data.service.folio || 'N/A'],
      ['Cliente:', data.service.client?.name || 'N/A'],
      ['Fecha de Servicio:', new Date(data.service.serviceDate).toLocaleDateString('es-CL')],
      ['Origen:', data.service.origin],
      ['Destino:', data.service.destination],
      ['Vehículo:', `${data.service.vehicleBrand} ${data.service.vehicleModel} - ${data.service.licensePlate}`],
      ['Grúa:', data.service.crane?.licensePlate || 'N/A'],
      ['Operador:', data.service.operator?.name || 'N/A'],
    ];

    (doc as any).autoTable({
      startY: yPosition,
      head: [],
      body: serviceData,
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        1: { cellWidth: 130 }
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [0, 150, 136],
        textColor: [255, 255, 255],
      },
      margin: { left: 20, right: 20 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;

    console.log('Información del servicio agregada correctamente');
    return yPosition;
  } catch (error) {
    console.error('Error en addServiceInfo:', error);
    return yPosition + 50;
  }
};

export const addEquipmentChecklist = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  try {
    const pageWidth = doc.internal.pageSize.width;
    
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

    // OBTENER DATOS DE EQUIPOS
    console.log('=== DEBUGGING VEHICLE EQUIPMENT ===');
    console.log('vehicleEquipment completo:', vehicleEquipment);
    
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
    console.log('Primera categoría:', firstCategory);
    
    if (!firstCategory || !firstCategory.items || !Array.isArray(firstCategory.items)) {
      console.error('La primera categoría no tiene items válidos');
      doc.setFontSize(10);
      doc.setTextColor(200, 50, 50);
      doc.text('Error: No hay elementos en la categoría de inspección', 20, yPosition);
      return yPosition + 20;
    }

    const allItems = firstCategory.items;
    console.log('Items encontrados:', allItems.length);
    console.log('Primeros 3 items:', allItems.slice(0, 3));

    // Obtener equipos seleccionados
    const selectedEquipment = data.inspection.equipment || [];
    console.log('Equipos seleccionados:', selectedEquipment);
    console.log('Tipo de elementos seleccionados:', selectedEquipment.map(item => typeof item));

    // Crear tabla con todos los elementos y su estado
    // IMPORTANTE: Convertir ambos a string para comparación segura
    const equipmentTableData = allItems.map(item => {
      const itemId = String(item.id);
      const isSelected = selectedEquipment.some(selectedId => String(selectedId) === itemId);
      
      // Debug para los primeros elementos
      if (allItems.indexOf(item) < 3) {
        console.log(`Item: ${item.name}, ID: ${itemId}, Seleccionado: ${isSelected}`);
      }
      
      return [item.name, isSelected ? '✓' : '✗'];
    });

    console.log('Total de filas en tabla:', equipmentTableData.length);

    // Dividir en 3 columnas para mejor presentación
    const itemsPerColumn = Math.ceil(equipmentTableData.length / 3);
    const tableRows: Array<[string, string, string, string, string, string]> = [];
    
    for (let i = 0; i < itemsPerColumn; i++) {
      const col1 = equipmentTableData[i] || ['', ''];
      const col2 = equipmentTableData[i + itemsPerColumn] || ['', ''];
      const col3 = equipmentTableData[i + itemsPerColumn * 2] || ['', ''];
      
      tableRows.push([col1[0], col1[1], col2[0], col2[1], col3[0], col3[1]]);
    }

    console.log('Filas de tabla generadas:', tableRows.length);

    // Generar la tabla
    (doc as any).autoTable({
      startY: yPosition,
      head: [['Elemento', '✓', 'Elemento', '✓', 'Elemento', '✓']],
      body: tableRows,
      theme: 'striped',
      columnStyles: {
        0: { cellWidth: 50, fontSize: 8 },
        1: { cellWidth: 10, halign: 'center', fontSize: 10 },
        2: { cellWidth: 50, fontSize: 8 },
        3: { cellWidth: 10, halign: 'center', fontSize: 10 },
        4: { cellWidth: 50, fontSize: 8 },
        5: { cellWidth: 10, halign: 'center', fontSize: 10 }
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [0, 150, 136],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { left: 20, right: 20 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;

    // Resumen de elementos seleccionados
    const selectedCount = selectedEquipment.length;
    const totalCount = allItems.length;
    
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Elementos verificados: ${selectedCount} de ${totalCount}`, 20, yPosition);
    yPosition += 10;

    console.log('Checklist de equipos agregado correctamente');
    console.log('=== FIN DEBUGGING ===');
    return yPosition;
    
  } catch (error) {
    console.error('Error en addEquipmentChecklist:', error);
    console.error('Stack trace:', error.stack);
    
    // Mostrar error en el PDF
    doc.setFontSize(10);
    doc.setTextColor(255, 0, 0);
    doc.text(`Error crítico: ${error.message}`, 20, yPosition);
    yPosition += 15;
    
    return yPosition;
  }
};

export const addObservationsAndSignatures = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  try {
    const pageWidth = doc.internal.pageSize.width;
    
    // Verificar si necesitamos una nueva página
    if (yPosition > 220) {
      doc.addPage();
      yPosition = 20;
    }

    // Observaciones
    if (data.inspection.vehicleObservations) {
      doc.setFontSize(12);
      doc.setTextColor(0, 150, 136);
      doc.text('OBSERVACIONES DEL VEHÍCULO', 20, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const splitObservations = doc.splitTextToSize(data.inspection.vehicleObservations, pageWidth - 40);
      doc.text(splitObservations, 20, yPosition);
      yPosition += splitObservations.length * 5 + 15;
    }

    // Firmas
    doc.setFontSize(12);
    doc.setTextColor(0, 150, 136);
    doc.text('FIRMAS Y VALIDACIÓN', 20, yPosition);
    yPosition += 20;

    // Firma del operador
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('_____________________________', 30, yPosition);
    doc.text('Firma del Operador', 30, yPosition + 8);
    doc.text(`${data.inspection.operatorSignature}`, 30, yPosition + 16);

    // Firma del cliente (si existe)
    if (data.inspection.clientName) {
      doc.text('_____________________________', pageWidth - 100, yPosition);
      doc.text('Firma del Cliente', pageWidth - 100, yPosition + 8);
      doc.text(`${data.inspection.clientName}`, pageWidth - 100, yPosition + 16);
    }

    yPosition += 30;

    console.log('Observaciones y firmas agregadas correctamente');
    return yPosition;
  } catch (error) {
    console.error('Error en addObservationsAndSignatures:', error);
    return yPosition + 50;
  }
};