
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { InspectionPDFData } from './pdfTypes';
import { vehicleEquipment } from '@/data/equipmentData';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Extend jsPDF interface to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

export const addServiceInfo = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  try {
    // Información del servicio mejorada
    doc.setFontSize(14);
    doc.setTextColor(0, 150, 136);
    doc.text('DATOS DEL SERVICIO', 20, yPosition);
    yPosition += 10;

    const serviceData = [
      ['Folio:', data.service.folio || 'No especificado'],
      ['Cliente:', data.service.client?.name || 'No especificado'],
      ['RUT Cliente:', data.service.client?.rut || 'No especificado'],
      ['Tipo de Servicio:', data.service.serviceType?.name || 'No especificado'],
      ['Fecha:', data.service.serviceDate ? format(new Date(data.service.serviceDate), "dd 'de' MMMM 'de' yyyy", { locale: es }) : 'No especificado'],
      ['Valor del Servicio:', `$${(data.service.value || 0).toLocaleString('es-CL')}`],
      ['Origen:', data.service.origin || 'No especificado'],
      ['Destino:', data.service.destination || 'No especificado'],
      ['Vehículo:', `${data.service.vehicleBrand || ''} ${data.service.vehicleModel || ''} - ${data.service.licensePlate || ''}`.trim()],
      ['Grúa:', `${data.service.crane?.licensePlate || 'No asignada'} (${data.service.crane?.brand || ''} ${data.service.crane?.model || ''})`.trim()],
      ['Operador:', data.service.operator?.name || 'No asignado'],
      ['Orden de Compra:', data.service.purchaseOrder || 'No especificada'],
    ];

    doc.autoTable({
      startY: yPosition,
      body: serviceData,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 
        0: { fontStyle: 'bold', cellWidth: 50, fillColor: [240, 240, 240] },
        1: { cellWidth: 120 }
      },
    });

    return doc.lastAutoTable.finalY + 15;
  } catch (error) {
    console.error('Error en addServiceInfo:', error);
    return yPosition + 80;
  }
};

export const addEquipmentChecklist = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  try {
    // Verificar si necesitamos nueva página
    if (yPosition > 200) {
      doc.addPage();
      yPosition = 20;
    }

    // Inventario del vehículo mejorado
    doc.setFontSize(14);
    doc.setTextColor(0, 150, 136);
    doc.text('INVENTARIO DEL VEHÍCULO', 20, yPosition);
    yPosition += 10;

    const equipmentData: string[][] = [];
    const checkedItems = data.inspection.equipment || [];
    
    console.log('Equipment seleccionado:', checkedItems);
    
    vehicleEquipment.forEach(category => {
      // Agregar cabecera de categoría
      equipmentData.push([category.name, '', 'CATEGORÍA']);
      
      // Agregar elementos de la categoría con estado correcto
      category.items.forEach(item => {
        const isChecked = checkedItems.includes(item.id);
        const status = isChecked ? '✓ SÍ' : '✗ NO';
        equipmentData.push(['', item.name, status]);
      });
      
      // Agregar línea separadora entre categorías
      if (category !== vehicleEquipment[vehicleEquipment.length - 1]) {
        equipmentData.push(['', '', '']);
      }
    });

    doc.autoTable({
      head: [['Categoría', 'Elemento', 'Estado']],
      body: equipmentData,
      startY: yPosition,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 
        0: { cellWidth: 45, fontStyle: 'bold' },
        1: { cellWidth: 100 },
        2: { cellWidth: 25, halign: 'center', fontStyle: 'bold' }
      },
      didParseCell: (data) => {
        if (data.row.raw && data.row.raw.length > 2) {
          if (data.row.raw[2] === 'CATEGORÍA') {
            data.cell.styles.fillColor = [0, 150, 136];
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.row.raw[2] === '✓ SÍ') {
            data.cell.styles.textColor = [0, 150, 0];
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.row.raw[2] === '✗ NO') {
            data.cell.styles.textColor = [200, 0, 0];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    return doc.lastAutoTable.finalY + 15;
  } catch (error) {
    console.error('Error en addEquipmentChecklist:', error);
    return yPosition + 100;
  }
};

export const addObservationsAndSignatures = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  try {
    // Verificar si necesitamos nueva página
    if (yPosition > 220) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(0, 150, 136);
    doc.text('OBSERVACIONES Y FIRMAS', 20, yPosition);
    yPosition += 15;

    const pageWidth = doc.internal.pageSize.width;

    // Observaciones del vehículo
    if (data.inspection.vehicleObservations) {
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Observaciones del vehículo:', 20, yPosition);
      yPosition += 8;
      doc.setFontSize(10);
      const splitText = doc.splitTextToSize(data.inspection.vehicleObservations, pageWidth - 40);
      doc.text(splitText, 20, yPosition);
      yPosition += splitText.length * 5 + 15;
    }

    // Información de firmas y validación
    const signaturesData = [
      ['Firma del Operador:', data.inspection.operatorSignature || 'No especificado'],
      ['Cliente (si presente):', data.inspection.clientName || 'No especificado'],
      ['RUT del Cliente:', data.inspection.clientRut || 'No especificado'],
      ['Fecha de Inspección:', format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })],
      ['Valor del Servicio:', `$${(data.service.value || 0).toLocaleString('es-CL')}`],
      ['Estado del Servicio:', data.service.status || 'En proceso'],
    ];

    doc.autoTable({
      startY: yPosition,
      body: signaturesData,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: { 
        0: { fontStyle: 'bold', cellWidth: 60, fillColor: [240, 240, 240] },
        1: { cellWidth: 110 }
      },
    });

    // Agregar nota al pie
    const finalY = doc.lastAutoTable.finalY + 20;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Este documento certifica el estado del vehículo e inventario al momento de la inspección pre-servicio.', 20, finalY);
    doc.text(`Documento generado automáticamente el ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}`, 20, finalY + 8);

    return finalY + 20;
  } catch (error) {
    console.error('Error en addObservationsAndSignatures:', error);
    return yPosition + 50;
  }
};
