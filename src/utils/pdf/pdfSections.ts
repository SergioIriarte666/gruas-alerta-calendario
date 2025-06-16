
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
      ['Fecha de Servicio:', new Date(data.service.service_date).toLocaleDateString('es-CL')],
      ['Origen:', data.service.origin],
      ['Destino:', data.service.destination],
      ['Vehículo:', `${data.service.vehicle_brand} ${data.service.vehicle_model} - ${data.service.license_plate}`],
      ['Grúa:', data.service.crane?.license_plate || 'N/A'],
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

    // Crear un mapa de los elementos seleccionados
    const selectedEquipment = data.inspection.equipment || [];
    console.log('Equipos seleccionados:', selectedEquipment);

    // Obtener detalles de los equipos seleccionados
    const equipmentDetails: Array<[string, string, string]> = [];
    
    vehicleEquipment.forEach(category => {
      const categoryItems = category.items.filter(item => 
        selectedEquipment.includes(item.id)
      );
      
      if (categoryItems.length > 0) {
        // Agregar encabezado de categoría
        equipmentDetails.push([category.name, '', '✓']);
        
        // Agregar elementos de la categoría
        categoryItems.forEach(item => {
          equipmentDetails.push(['', item.name, '✓']);
        });
      }
    });

    if (equipmentDetails.length === 0) {
      equipmentDetails.push(['Sin equipos seleccionados', '', '']);
    }

    // Crear tabla con el inventario
    (doc as any).autoTable({
      startY: yPosition,
      head: [['Categoría/Elemento', 'Descripción', 'Estado']],
      body: equipmentDetails,
      theme: 'striped',
      columnStyles: {
        0: { cellWidth: 70, fontStyle: function(data: any) {
          return data.row.raw[1] === '' ? 'bold' : 'normal';
        }},
        1: { cellWidth: 80 },
        2: { cellWidth: 20, halign: 'center' }
      },
      styles: {
        fontSize: 9,
        cellPadding: 2,
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [0, 150, 136],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { left: 20, right: 20 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;

    console.log('Checklist de equipos agregado correctamente');
    return yPosition;
  } catch (error) {
    console.error('Error en addEquipmentChecklist:', error);
    return yPosition + 50;
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
