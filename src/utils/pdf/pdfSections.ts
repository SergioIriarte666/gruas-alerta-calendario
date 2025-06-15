
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { InspectionPDFData } from './pdfTypes';
import { vehicleEquipment } from '@/data/equipmentData';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Extend jsPDF interface to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
    lastAutoTable: { finalY: number };
  }
}

export const addServiceInfo = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  // Información del servicio
  doc.setFontSize(14);
  doc.setTextColor(0, 150, 136);
  doc.text('DATOS DEL SERVICIO', 20, yPosition);
  yPosition += 10;

  const serviceData = [
    ['Folio:', data.service.folio],
    ['Cliente:', data.service.client?.name || 'No especificado'],
    ['Tipo de Servicio:', data.service.serviceType?.name || 'No especificado'],
    ['Fecha:', format(new Date(data.service.serviceDate), "dd 'de' MMMM 'de' yyyy", { locale: es })],
    ['Origen:', data.service.origin],
    ['Destino:', data.service.destination],
    ['Vehículo:', `${data.service.vehicleBrand} ${data.service.vehicleModel} - ${data.service.licensePlate}`],
    ['Operador:', data.service.operator?.name || 'No asignado'],
  ];

  doc.autoTable({
    startY: yPosition,
    body: serviceData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
  });

  return doc.lastAutoTable.finalY + 15;
};

export const addEquipmentChecklist = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  // Inventario del vehículo
  doc.setFontSize(14);
  doc.setTextColor(0, 150, 136);
  doc.text('INVENTARIO DEL VEHÍCULO', 20, yPosition);
  yPosition += 10;

  const equipmentData: string[][] = [];
  const checkedItems = data.inspection.equipment || [];
  
  vehicleEquipment.forEach(category => {
    // Agregar cabecera de categoría
    equipmentData.push([category.name, '', 'CATEGORÍA']);
    
    // Agregar elementos de la categoría
    category.items.forEach(item => {
      const isChecked = checkedItems.includes(item.id);
      const status = isChecked ? '✓' : '✗';
      equipmentData.push(['', item.name, status]);
    });
  });

  doc.autoTable({
    head: [['Categoría', 'Elemento', 'Estado']],
    body: equipmentData,
    startY: yPosition,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 100 },
      2: { cellWidth: 20, halign: 'center' }
    },
    didParseCell: (data) => {
      if (data.row.raw && data.row.raw.length > 2) {
        if (data.row.raw[2] === 'CATEGORÍA') {
          data.cell.styles.fillColor = [240, 240, 240];
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.row.raw[2] === '✓') {
          data.cell.styles.textColor = [0, 150, 0];
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.row.raw[2] === '✗') {
          data.cell.styles.textColor = [200, 0, 0];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });

  return doc.lastAutoTable.finalY + 15;
};

export const addObservationsAndSignatures = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  // Verificar si necesitamos nueva página
  if (yPosition > 200) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(14);
  doc.setTextColor(0, 150, 136);
  doc.text('OBSERVACIONES Y FIRMAS', 20, yPosition);
  yPosition += 15;

  const pageWidth = doc.internal.pageSize.width;

  if (data.inspection.vehicleObservations) {
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Observaciones del vehículo:', 20, yPosition);
    yPosition += 8;
    doc.setFontSize(10);
    const splitText = doc.splitTextToSize(data.inspection.vehicleObservations, pageWidth - 40);
    doc.text(splitText, 20, yPosition);
    yPosition += splitText.length * 5 + 10;
  }

  const signaturesData = [
    ['Firma del Operador:', data.inspection.operatorSignature || 'No especificado'],
    ['Cliente (si presente):', data.inspection.clientName || 'No especificado'],
    ['RUT del Cliente:', data.inspection.clientRut || 'No especificado'],
    ['Fecha de Inspección:', format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })],
  ];

  doc.autoTable({
    startY: yPosition,
    body: signaturesData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
  });

  return doc.lastAutoTable.finalY;
};
