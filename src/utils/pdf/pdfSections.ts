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
const addModernHeader = (doc: jsPDF): number => {
  const pageWidth = doc.internal.pageSize.width;
  
  // Fondo del header
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  // Título principal
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('REPORTE DE INSPECCIÓN PRE-SERVICIO', 20, 15);
  
  // Subtítulo
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('TMS - Transport Management System', 20, 25);
  
  // Información de contacto en la derecha
  doc.setFontSize(8);
  doc.text('RUT: 12.345.678-9', pageWidth - 60, 12);
  doc.text('Tel: +56 9 1234 5678', pageWidth - 60, 18);
  doc.text('contacto@tms.cl', pageWidth - 60, 24);
  
  return 45; // Retorna posición Y después del header
};

// Función para crear métricas dashboard
const addDashboardMetrics = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  const pageWidth = doc.internal.pageSize.width;
  
  // Obtener datos para métricas
  const allItems = vehicleEquipment[0]?.items || [];
  const selectedEquipment = data.inspection.equipment || [];
  const completionRate = allItems.length > 0 ? Math.round((selectedEquipment.length / allItems.length) * 100) : 0;
  
  // Título de sección
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('📊 RESUMEN EJECUTIVO', 20, yPosition);
  yPosition += 15;
  
  // Card 1: Progreso general
  const cardWidth = (pageWidth - 60) / 3;
  const cardHeight = 35;
  
  // Card 1 - Progreso
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(20, yPosition, cardWidth, cardHeight, 3, 3, 'F');
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(1);
  doc.roundedRect(20, yPosition, cardWidth, cardHeight, 3, 3, 'S');
  
  doc.setTextColor(...COLORS.primary);
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
  doc.setFillColor(...COLORS.success);
  doc.rect(25, yPosition + 28, progressWidth, 3, 'F');
  
  // Card 2 - Elementos verificados
  const card2X = 30 + cardWidth;
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(card2X, yPosition, cardWidth, cardHeight, 3, 3, 'F');
  doc.setDrawColor(...COLORS.success);
  doc.roundedRect(card2X, yPosition, cardWidth, cardHeight, 3, 3, 'S');
  
  doc.setTextColor(...COLORS.success);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`${selectedEquipment.length}/${allItems.length}`, card2X + 5, yPosition + 15);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('ELEMENTOS OK', card2X + 5, yPosition + 25);
  
  // Card 3 - Estado del servicio
  const card3X = 40 + cardWidth * 2;
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(card3X, yPosition, cardWidth, cardHeight, 3, 3, 'F');
  doc.setDrawColor(...COLORS.secondary);
  doc.roundedRect(card3X, yPosition, cardWidth, cardHeight, 3, 3, 'S');
  
  doc.setTextColor(...COLORS.secondary);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const status = completionRate === 100 ? 'COMPLETO' : 'EN PROCESO';
  doc.text(status, card3X + 5, yPosition + 15);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('ESTADO', card3X + 5, yPosition + 25);
  
  // Círculo de estado
  const circleX = card3X + cardWidth - 15;
  const circleY = yPosition + 15;
  const statusColor = completionRate === 100 ? COLORS.success : COLORS.warning;
  doc.setFillColor(...statusColor);
  doc.circle(circleX, circleY, 4, 'F');
  
  return yPosition + cardHeight + 20;
};

export const addServiceInfo = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  try {
    const pageWidth = doc.internal.pageSize.width;
    
    // Título de la sección con icono
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.dark);
    doc.setFont('helvetica', 'bold');
    doc.text('📋 INFORMACIÓN DEL SERVICIO', 20, yPosition);
    yPosition += 12;

    // Folio destacado
    doc.setFillColor(...COLORS.primary);
    doc.roundedRect(20, yPosition, pageWidth - 40, 25, 3, 3, 'F');
    
    doc.setTextColor(...COLORS.white);
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
          textColor: COLORS.dark,
          fontSize: 9
        },
        1: { 
          cellWidth: 125,
          textColor: COLORS.dark,
          fontSize: 9
        }
      },
      styles: {
        cellPadding: 6,
        lineColor: COLORS.light,
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

    // Título de la sección con icono
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.dark);
    doc.setFont('helvetica', 'bold');
    doc.text('🔧 INVENTARIO DE EQUIPOS Y ACCESORIOS', 20, yPosition);
    yPosition += 15;

    // Obtener datos
    if (!vehicleEquipment || !Array.isArray(vehicleEquipment) || vehicleEquipment.length === 0) {
      console.error('vehicleEquipment no está disponible');
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.danger);
      doc.text('Error: No se pudo cargar el inventario de equipos', 20, yPosition);
      return yPosition + 20;
    }

    const firstCategory = vehicleEquipment[0];
    if (!firstCategory?.items || !Array.isArray(firstCategory.items)) {
      console.error('No hay elementos en la categoría');
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.danger);
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
        isSelected ? '✅' : '❌',
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
      head: [['ELEMENTO', '✓', 'ESTADO', 'ELEMENTO', '✓', 'ESTADO']],
      body: tableRows,
      theme: 'striped',
      columnStyles: {
        0: { cellWidth: 50, fontSize: 8, textColor: COLORS.dark },
        1: { cellWidth: 12, halign: 'center', fontSize: 12 },
        2: { cellWidth: 20, fontSize: 7, textColor: COLORS.secondary, fontStyle: 'bold' },
        3: { cellWidth: 50, fontSize: 8, textColor: COLORS.dark },
        4: { cellWidth: 12, halign: 'center', fontSize: 12 },
        5: { cellWidth: 20, fontSize: 7, textColor: COLORS.secondary, fontStyle: 'bold' }
      },
      styles: {
        fontSize: 8,
        cellPadding: 4,
        textColor: COLORS.dark,
        lineColor: [220, 220, 220],
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: COLORS.primary,
        textColor: COLORS.white,
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
    doc.setFillColor(...COLORS.light);
    doc.roundedRect(20, yPosition, pageWidth - 40, 25, 3, 3, 'F');
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(1);
    doc.roundedRect(20, yPosition, pageWidth - 40, 25, 3, 3, 'S');
    
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`📈 RESUMEN: ${selectedCount} de ${totalCount} elementos verificados (${percentage}%)`, 25, yPosition + 15);

    console.log('Checklist de equipos agregado correctamente');
    return yPosition + 35;
    
  } catch (error) {
    console.error('Error en addEquipmentChecklist:', error);
    
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.danger);
    doc.text(`❌ Error crítico: ${error.message}`, 20, yPosition);
    return yPosition + 15;
  }
};

export const addObservationsAndSignatures = (doc: jsPDF, data: InspectionPDFData, yPosition: number): number => {
  try {
    const pageWidth = doc.internal.pageSize.width;
    
    // Verificar si necesitamos una nueva página
    if (yPosition > 200) {
      doc.addPage();
      yPosition = 20;
    }

    // Observaciones con diseño moderno
    if (data.inspection.vehicleObservations) {
      doc.setFontSize(14);
      doc.setTextColor(...COLORS.dark);
      doc.setFont('helvetica', 'bold');
      doc.text('💬 OBSERVACIONES DEL VEHÍCULO', 20, yPosition);
      yPosition += 15;

      // Card para observaciones
      const observationHeight = 30;
      doc.setFillColor(...COLORS.light);
      doc.roundedRect(20, yPosition, pageWidth - 40, observationHeight, 3, 3, 'F');
      doc.setDrawColor(...COLORS.warning);
      doc.setLineWidth(1);
      doc.roundedRect(20, yPosition, pageWidth - 40, observationHeight, 3, 3, 'S');

      doc.setFontSize(10);
      doc.setTextColor(...COLORS.dark);
      const splitObservations = doc.splitTextToSize(data.inspection.vehicleObservations, pageWidth - 50);
      doc.text(splitObservations, 25, yPosition + 12);
      yPosition += observationHeight + 20;
    }

    // Firmas con diseño profesional
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.dark);
    doc.setFont('helvetica', 'bold');
    doc.text('✍️ FIRMAS Y VALIDACIÓN', 20, yPosition);
    yPosition += 20;

    // Cards para firmas
    const signatureWidth = (pageWidth - 60) / 2;
    const signatureHeight = 50;

    // Firma del operador
    doc.setFillColor(...COLORS.light);
    doc.roundedRect(20, yPosition, signatureWidth, signatureHeight, 3, 3, 'F');
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(1);
    doc.roundedRect(20, yPosition, signatureWidth, signatureHeight, 3, 3, 'S');

    doc.setFontSize(10);
    doc.setTextColor(...COLORS.dark);
    doc.setFont('helvetica', 'bold');
    doc.text('OPERADOR', 25, yPosition + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.inspection.operatorSignature}`, 25, yPosition + 35);
    
    // Línea de firma
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.5);
    doc.line(25, yPosition + 42, 25 + signatureWidth - 10, yPosition + 42);

    // Firma del cliente (si existe)
    if (data.inspection.clientName) {
      const clientX = 30 + signatureWidth;
      doc.setFillColor(...COLORS.light);
      doc.roundedRect(clientX, yPosition, signatureWidth, signatureHeight, 3, 3, 'F');
      doc.setDrawColor(...COLORS.secondary);
      doc.setLineWidth(1);
      doc.roundedRect(clientX, yPosition, signatureWidth, signatureHeight, 3, 3, 'S');

      doc.setFontSize(10);
      doc.setTextColor(...COLORS.dark);
      doc.setFont('helvetica', 'bold');
      doc.text('CLIENTE', clientX + 5, yPosition + 12);
      doc.setFont('helvetica', 'normal');
      doc.text(`${data.inspection.clientName}`, clientX + 5, yPosition + 35);
      
      // Línea de firma
      doc.setDrawColor(...COLORS.secondary);
      doc.setLineWidth(0.5);
      doc.line(clientX + 5, yPosition + 42, clientX + signatureWidth - 5, yPosition + 42);
    }

    yPosition += signatureHeight + 20;

    // Footer con timestamp
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.dark);
    doc.text(`🕒 Documento generado automáticamente el ${new Date().toLocaleString('es-CL')}`, 20, yPosition);

    console.log('Observaciones y firmas agregadas correctamente');
    return yPosition + 10;
  } catch (error) {
    console.error('Error en addObservationsAndSignatures:', error);
    return yPosition + 50;
  }
};

// Nueva función para crear PDF completo con dashboard
export const createDashboardPDF = (data: InspectionPDFData): jsPDF => {
  const doc = new jsPDF();
  
  let yPosition = addModernHeader(doc);
  yPosition = addDashboardMetrics(doc, data, yPosition);
  yPosition = addServiceInfo(doc, data, yPosition);
  yPosition = addEquipmentChecklist(doc, data, yPosition);
  addObservationsAndSignatures(doc, data, yPosition);
  
  return doc;
};