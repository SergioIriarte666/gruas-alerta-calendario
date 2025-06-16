import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InspectionPDFData } from './pdfTypes';
import { vehicleEquipment } from '@/data/equipmentData';

// Colores del dashboard moderno
const COLORS = {
  primary: [20, 184, 166],      // Teal moderno
  secondary: [99, 102, 241],    // Indigo
  success: [34, 197, 94],       // Verde
  warning: [251, 146, 60],      // Naranja
  danger: [239, 68, 68],        // Rojo
  dark: [17, 24, 39],           // Gris oscuro
  light: [248, 250, 252],       // Gris claro
  white: [255, 255, 255],
  accent: [168, 85, 247]        // Púrpura
};

// Función para crear header moderno
const addModernHeader = (doc: jsPDF, data: InspectionPDFData): number => {
  const pageWidth = doc.internal.pageSize.width;
  
  // Fondo del header
  doc.setFillColor(20, 184, 166);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  // Título principal
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('REPORTE DE INSPECCION PRE-SERVICIO', 20, 15);
  
  // Subtítulo - Nombre de la empresa
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(data.companyData.businessName || 'TMS - Transport Management System', 20, 25);
  
  // Información de contacto en la derecha
  doc.setFontSize(8);
  doc.text(`RUT: ${data.companyData.rut || 'N/A'}`, pageWidth - 80, 12);
  doc.text(`Tel: ${data.companyData.phone || 'N/A'}`, pageWidth - 80, 18);
  doc.text(data.companyData.email || 'contacto@empresa.cl', pageWidth - 80, 24);
  
  return 45; // Retorna posición Y después del header
};

// Función para agregar información de la empresa después del header
const addCompanyInfo = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  const pageWidth = doc.internal.pageSize.width;
  
  // Información de la empresa en formato simple
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  
  const companyInfo = `${data.companyData.businessName || 'Empresa'} | RUT: ${data.companyData.rut || 'N/A'} | ${data.companyData.address || 'Direccion no disponible'}`;
  const phoneEmail = `Tel: ${data.companyData.phone || 'N/A'} | Email: ${data.companyData.email || 'N/A'}`;
  
  doc.text(companyInfo, 20, yPosition);
  doc.text(phoneEmail, 20, yPosition + 8);
  
  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(20, yPosition + 15, pageWidth - 20, yPosition + 15);
  
  return yPosition + 25;
};

// Función para crear métricas dashboard
const addDashboardMetrics = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  const pageWidth = doc.internal.pageSize.width;
  
  // Obtener datos para métricas
  const allItems = vehicleEquipment[0]?.items || [];
  const selectedEquipment = data.inspection.equipment || [];
  const completionRate = allItems.length > 0 ? Math.round((selectedEquipment.length / allItems.length) * 100) : 0;
  
  // Título de sección
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMEN EJECUTIVO', 20, yPosition);
  yPosition += 15;
  
  // Card 1: Progreso general
  const cardWidth = (pageWidth - 60) / 3;
  const cardHeight = 35;
  
  // Card 1 - Progreso
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(20, yPosition, cardWidth, cardHeight, 3, 3, 'F');
  doc.setDrawColor(20, 184, 166);
  doc.setLineWidth(1);
  doc.roundedRect(20, yPosition, cardWidth, cardHeight, 3, 3, 'S');
  
  doc.setTextColor(20, 184, 166);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(`${completionRate}%`, 25, yPosition + 15);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('COMPLETADO', 25, yPosition + 25);
  
  // Barra de progreso
  const progressBarWidth = cardWidth - 20;
  const progressWidth = (progressBarWidth * completionRate) / 100;
  doc.setFillColor(230, 230, 230);
  doc.rect(25, yPosition + 28, progressBarWidth, 3, 'F');
  doc.setFillColor(34, 197, 94);
  doc.rect(25, yPosition + 28, progressWidth, 3, 'F');
  
  // Card 2 - Elementos verificados
  const card2X = 30 + cardWidth;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(card2X, yPosition, cardWidth, cardHeight, 3, 3, 'F');
  doc.setDrawColor(34, 197, 94);
  doc.roundedRect(card2X, yPosition, cardWidth, cardHeight, 3, 3, 'S');
  
  doc.setTextColor(34, 197, 94);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`${selectedEquipment.length}/${allItems.length}`, card2X + 5, yPosition + 15);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('ELEMENTOS OK', card2X + 5, yPosition + 25);
  
  // Card 3 - Estado del servicio
  const card3X = 40 + cardWidth * 2;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(card3X, yPosition, cardWidth, cardHeight, 3, 3, 'F');
  doc.setDrawColor(99, 102, 241);
  doc.roundedRect(card3X, yPosition, cardWidth, cardHeight, 3, 3, 'S');
  
  doc.setTextColor(99, 102, 241);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const status = completionRate === 100 ? 'COMPLETO' : 'EN PROCESO';
  doc.text(status, card3X + 5, yPosition + 15);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('ESTADO', card3X + 5, yPosition + 25);
  
  // Círculo de estado - CORREGIDO
  const circleX = card3X + cardWidth - 15;
  const circleY = yPosition + 15;
  if (completionRate === 100) {
    doc.setFillColor(34, 197, 94); // Verde
  } else {
    doc.setFillColor(251, 146, 60); // Naranja
  }
  doc.circle(circleX, circleY, 4, 'F');
  
  return yPosition + cardHeight + 20;
};

export const addServiceInfo = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  try {
    const pageWidth = doc.internal.pageSize.width;
    
    // Título de la sección
    doc.setFontSize(14);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DEL SERVICIO', 20, yPosition);
    yPosition += 12;

    // Folio destacado
    doc.setFillColor(20, 184, 166);
    doc.roundedRect(20, yPosition, pageWidth - 40, 25, 3, 3, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`FOLIO: ${data.service.folio || 'N/A'}`, 25, yPosition + 10);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const now = new Date();
    doc.text(`Documento generado: ${now.toLocaleDateString('es-CL')} - ${now.toLocaleTimeString('es-CL')}`, 25, yPosition + 18);
    
    yPosition += 35;

    // Datos del servicio en grid moderno
    const serviceData = [
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
      theme: 'plain',
      columnStyles: {
        0: { 
          cellWidth: 45, 
          fontStyle: 'bold',
          textColor: [17, 24, 39],
          fontSize: 9
        },
        1: { 
          cellWidth: 125,
          textColor: [17, 24, 39],
          fontSize: 9
        }
      },
      styles: {
        cellPadding: 6,
        lineColor: [248, 250, 252],
        lineWidth: 0.5,
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },
      margin: { left: 20, right: 20 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 20;
    
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
    doc.setFontSize(14);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text('INVENTARIO DE EQUIPOS Y ACCESORIOS', 20, yPosition);
    yPosition += 15;

    // Obtener datos
    if (!vehicleEquipment || !Array.isArray(vehicleEquipment) || vehicleEquipment.length === 0) {
      console.error('vehicleEquipment no está disponible');
      doc.setFontSize(10);
      doc.setTextColor(239, 68, 68);
      doc.text('Error: No se pudo cargar el inventario de equipos', 20, yPosition);
      return yPosition + 20;
    }

    const firstCategory = vehicleEquipment[0];
    if (!firstCategory?.items || !Array.isArray(firstCategory.items)) {
      console.error('No hay elementos en la categoría');
      doc.setFontSize(10);
      doc.setTextColor(239, 68, 68);
      doc.text('Error: No hay elementos en la categoría de inspección', 20, yPosition);
      return yPosition + 20;
    }

    const allItems = firstCategory.items;
    const selectedEquipment = data.inspection.equipment || [];

    // Header de la tabla más moderno
    const equipmentTableData = allItems.map(item => {
      const itemId = String(item.id);
      const isSelected = selectedEquipment.some(selectedId => String(selectedId) === itemId);
      
      return [
        item.name, 
        isSelected ? 'SI' : 'NO',
        isSelected ? 'OK' : 'FALTANTE'
      ];
    });

    // Dividir en 2 columnas para mejor legibilidad
    const itemsPerColumn = Math.ceil(equipmentTableData.length / 2);
    const tableRows: Array<[string, string, string, string, string, string]> = [];
    
    for (let i = 0; i < itemsPerColumn; i++) {
      const col1 = equipmentTableData[i] || ['', '', ''];
      const col2 = equipmentTableData[i + itemsPerColumn] || ['', '', ''];
      
      tableRows.push([
        col1[0], col1[1], col1[2],
        col2[0], col2[1], col2[2]
      ]);
    }

    // Tabla con diseño dashboard
    autoTable(doc, {
      startY: yPosition,
      head: [['ELEMENTO', 'VERIF', 'ESTADO', 'ELEMENTO', 'VERIF', 'ESTADO']],
      body: tableRows,
      theme: 'striped',
      columnStyles: {
        0: { cellWidth: 45, fontSize: 8, textColor: [17, 24, 39] },
        1: { cellWidth: 15, halign: 'center', fontSize: 8, fontStyle: 'bold' },
        2: { cellWidth: 20, fontSize: 7, textColor: [99, 102, 241], fontStyle: 'bold' },
        3: { cellWidth: 45, fontSize: 8, textColor: [17, 24, 39] },
        4: { cellWidth: 15, halign: 'center', fontSize: 8, fontStyle: 'bold' },
        5: { cellWidth: 20, fontSize: 7, textColor: [99, 102, 241], fontStyle: 'bold' }
      },
      styles: {
        fontSize: 8,
        cellPadding: 4,
        textColor: [17, 24, 39],
        lineColor: [220, 220, 220],
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [20, 184, 166],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 20, right: 20 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;

    // Resumen visual mejorado
    const selectedCount = selectedEquipment.length;
    const totalCount = allItems.length;
    const percentage = Math.round((selectedCount / totalCount) * 100);
    
    // Card de resumen
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(20, yPosition, pageWidth - 40, 25, 3, 3, 'F');
    doc.setDrawColor(20, 184, 166);
    doc.setLineWidth(1);
    doc.roundedRect(20, yPosition, pageWidth - 40, 25, 3, 3, 'S');
    
    doc.setTextColor(20, 184, 166);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`RESUMEN: ${selectedCount} de ${totalCount} elementos verificados (${percentage}%)`, 25, yPosition + 15);

    console.log('Checklist de equipos agregado correctamente');
    return yPosition + 35;
    
  } catch (error) {
    console.error('Error en addEquipmentChecklist:', error);
    
    doc.setFontSize(10);
    doc.setTextColor(239, 68, 68);
    doc.text(`Error crítico: ${error.message}`, 20, yPosition);
    return yPosition + 15;
  }
};

export const addObservationsAndSignatures = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  try {
    const pageWidth = doc.internal.pageSize.width;
    
    // Verificar si necesitamos una nueva página para las firmas
    if (yPosition > 180) {
      doc.addPage();
      yPosition = 20;
    }

    // Observaciones con diseño moderno
    if (data.inspection.vehicleObservations) {
      doc.setFontSize(14);
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.text('OBSERVACIONES DEL VEHICULO', 20, yPosition);
      yPosition += 15;

      // Card para observaciones
      const observationHeight = 30;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(20, yPosition, pageWidth - 40, observationHeight, 3, 3, 'F');
      doc.setDrawColor(251, 146, 60);
      doc.setLineWidth(1);
      doc.roundedRect(20, yPosition, pageWidth - 40, observationHeight, 3, 3, 'S');

      doc.setFontSize(10);
      doc.setTextColor(17, 24, 39);
      const splitObservations = doc.splitTextToSize(data.inspection.vehicleObservations, pageWidth - 50);
      doc.text(splitObservations, 25, yPosition + 12);
      yPosition += observationHeight + 20;
    }

    // Verificar espacio para firmas antes de agregarlas
    if (yPosition > 200) {
      doc.addPage();
      yPosition = 20;
    }

    // Firmas con diseño profesional
    doc.setFontSize(14);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text('FIRMAS Y VALIDACION', 20, yPosition);
    yPosition += 25;

    // Cards para firmas con más espacio
    const signatureWidth = (pageWidth - 80) / 2; // Más espacio entre cards
    const signatureHeight = 70; // Altura aumentada

    // Firma del operador
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(20, yPosition, signatureWidth, signatureHeight, 3, 3, 'F');
    doc.setDrawColor(20, 184, 166);
    doc.setLineWidth(1);
    doc.roundedRect(20, yPosition, signatureWidth, signatureHeight, 3, 3, 'S');

    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text('OPERADOR', 25, yPosition + 18);
    
    // Espacio para firma manuscrita
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.inspection.operatorSignature}`, 25, yPosition + 45);
    
    // Línea de firma del operador
    doc.setDrawColor(20, 184, 166);
    doc.setLineWidth(0.5);
    doc.line(25, yPosition + 55, 25 + signatureWidth - 10, yPosition + 55);

    // Firma del cliente (si existe) - Bien separada
    if (data.inspection.clientName) {
      const clientX = 50 + signatureWidth; // Más separación
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(clientX, yPosition, signatureWidth, signatureHeight, 3, 3, 'F');
      doc.setDrawColor(99, 102, 241);
      doc.setLineWidth(1);
      doc.roundedRect(clientX, yPosition, signatureWidth, signatureHeight, 3, 3, 'S');

      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.text('CLIENTE', clientX + 5, yPosition + 18);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`${data.inspection.clientName}`, clientX + 5, yPosition + 45);
      
      // Línea de firma del cliente
      doc.setDrawColor(99, 102, 241);
      doc.setLineWidth(0.5);
      doc.line(clientX + 5, yPosition + 55, clientX + signatureWidth - 5, yPosition + 55);
    }

    yPosition += signatureHeight + 25;

    // Footer con información de la empresa
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${data.companyData.businessName || 'Empresa'} - ${data.companyData.address || 'Direccion no disponible'}`, 20, yPosition);
    yPosition += 8;
    doc.text(`Documento generado automaticamente el ${new Date().toLocaleString('es-CL')}`, 20, yPosition);

    console.log('Observaciones y firmas agregadas correctamente');
    return yPosition + 15;
  } catch (error) {
    console.error('Error en addObservationsAndSignatures:', error);
    return yPosition + 50;
  }
};

// Nueva función para crear PDF completo con dashboard
export const createDashboardPDF = (data: InspectionPDFData): jsPDF => {
  const doc = new jsPDF();
  
  let yPosition = addModernHeader(doc, data);
  yPosition = addCompanyInfo(doc, data, yPosition);
  yPosition = addDashboardMetrics(doc, data, yPosition);
  yPosition = addServiceInfo(doc, data, yPosition);
  yPosition = addEquipmentChecklist(doc, data, yPosition);
  addObservationsAndSignatures(doc, data, yPosition);
  
  return doc;
};