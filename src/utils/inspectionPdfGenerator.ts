
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { Service } from '@/types';
import { vehicleEquipment } from '@/data/equipmentData';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface InspectionPDFData {
  service: Service;
  inspection: InspectionFormValues;
  companyData?: {
    businessName: string;
    rut: string;
    address: string;
    phone: string;
    email: string;
    logoUrl?: string;
  };
}

export const generateInspectionPDF = async (data: InspectionPDFData): Promise<Blob> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let yPosition = 20;

  // Header con logo y datos de la empresa
  doc.setFontSize(20);
  doc.setTextColor(0, 150, 136); // tms-green
  doc.text('REPORTE DE INSPECCIÓN PRE-SERVICIO', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  if (data.companyData) {
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(data.companyData.businessName, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    doc.setFontSize(10);
    doc.text(`RUT: ${data.companyData.rut}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
    doc.text(`${data.companyData.address} | ${data.companyData.phone} | ${data.companyData.email}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;
  }

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

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // Checklist de equipamiento
  doc.setFontSize(14);
  doc.setTextColor(0, 150, 136);
  doc.text('CHECKLIST DE EQUIPAMIENTO', 20, yPosition);
  yPosition += 10;

  const equipmentData: string[][] = [];
  vehicleEquipment.forEach(category => {
    equipmentData.push([category.name, '', 'CATEGORÍA']);
    category.items.forEach(item => {
      const isChecked = data.inspection.equipment.includes(item.id);
      equipmentData.push(['', item.name, isChecked ? '✓' : '✗']);
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
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // Función para agregar fotos
  const addPhotosSection = async (title: string, photoNames: string[]) => {
    if (photoNames.length === 0) return;

    // Verificar si necesitamos nueva página
    if (yPosition > 240) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(0, 150, 136);
    doc.text(title, 20, yPosition);
    yPosition += 10;

    let photosPerRow = 2;
    let photoWidth = (pageWidth - 60) / photosPerRow;
    let photoHeight = photoWidth * 0.75;

    for (let i = 0; i < photoNames.length; i += photosPerRow) {
      // Verificar espacio para fotos
      if (yPosition + photoHeight > 280) {
        doc.addPage();
        yPosition = 20;
      }

      for (let j = 0; j < photosPerRow && i + j < photoNames.length; j++) {
        const photoName = photoNames[i + j];
        const photoData = localStorage.getItem(`photo-${photoName}`);
        
        if (photoData) {
          try {
            const xPos = 20 + j * (photoWidth + 10);
            doc.addImage(photoData, 'JPEG', xPos, yPosition, photoWidth, photoHeight);
            
            // Agregar nombre de archivo debajo de la foto
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(photoName, xPos, yPosition + photoHeight + 5);
          } catch (error) {
            console.warn(`Error al agregar foto ${photoName}:`, error);
          }
        }
      }
      yPosition += photoHeight + 15;
    }
    yPosition += 10;
  };

  // Agregar secciones de fotos
  await addPhotosSection('FOTOS ANTES DEL SERVICIO', data.inspection.photosBeforeService);
  await addPhotosSection('FOTOS DEL VEHÍCULO DEL CLIENTE', data.inspection.photosClientVehicle);
  await addPhotosSection('FOTOS DEL EQUIPO UTILIZADO', data.inspection.photosEquipmentUsed);

  // Observaciones y firmas
  if (yPosition > 200) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(14);
  doc.setTextColor(0, 150, 136);
  doc.text('OBSERVACIONES Y FIRMAS', 20, yPosition);
  yPosition += 15;

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
    ['Firma del Operador:', data.inspection.operatorSignature],
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

  return doc.output('blob');
};
