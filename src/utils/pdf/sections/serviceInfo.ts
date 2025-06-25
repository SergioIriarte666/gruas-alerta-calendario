
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InspectionPDFData } from '../pdfTypes';

export const addServiceInfo = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  try {
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

    autoTable(doc, {
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
