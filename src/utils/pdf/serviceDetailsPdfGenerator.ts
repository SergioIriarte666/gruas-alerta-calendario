import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPDFHeader } from './pdfHeader';
import { fetchCompanyData } from './companyDataFetcher';
import { formatCurrency, formatVehicleInfo, shouldShowVehicleInfo } from '@/utils/statusHelpers';
import { 
  getDisplayServiceValue, 
  getServiceValueBreakdown, 
  isCustodyService, 
  getCustodyInfo, 
  isEquipmentRentalService 
} from '@/utils/serviceValueCalculations';
import { formatForDisplay, formatForDisplayWithTime } from '@/utils/timezoneUtils';
import { fetchServiceItemsBreakdown, ITEMS_SERVICE_TYPES } from './serviceItemsData';

interface ServiceDetailsPDFData {
  service: any;
  totalCosts: number;
  totalCommissions: number;
  netProfit: number;
}

const TMS_GREEN = [0, 150, 136] as [number, number, number];
const LIGHT_GRAY = [245, 245, 245] as [number, number, number];

const addServiceItemsSection = async (
  doc: jsPDF,
  serviceId: string,
  yPosition: number
): Promise<number> => {
  const breakdown = await fetchServiceItemsBreakdown(serviceId);
  if (!breakdown) return yPosition;
  const { items, subtotal, iva, total } = breakdown;

  const clp = new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  });

  yPosition = addSectionTitle(doc, 'DESGLOSE DE TRABAJOS', yPosition);

  const tableBody = items.map((item) => [
    item.glosa || '',
    Number(item.cantidad).toString(),
    clp.format(Number(item.valor_unitario)),
    clp.format(Number(item.cantidad) * Number(item.valor_unitario)),
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Glosa', 'Cant.', 'Valor unit.', 'Total neto']],
    body: tableBody,
    foot: [
      ['', '', 'Subtotal neto', clp.format(subtotal)],
      ['', '', 'IVA 19%', clp.format(iva)],
      ['', '', 'Total con IVA', clp.format(total)],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: TMS_GREEN,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: 'bold',
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 95 },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
    },
    footStyles: {
      fillColor: LIGHT_GRAY,
      textColor: [0, 0, 0] as [number, number, number],
      fontStyle: 'bold',
      fontSize: 9,
    },
    didParseCell: function (data) {
      if (data.section === 'foot' && data.row.index === 2) {
        data.cell.styles.fillColor = TMS_GREEN;
        data.cell.styles.textColor = [255, 255, 255] as [number, number, number];
        data.cell.styles.fontSize = 10;
      }
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [0, 0, 0] as [number, number, number],
    },
    margin: { left: 20, right: 20 },
  });

  return (doc as any).lastAutoTable.finalY + 10;
};

export const generateServiceDetailsPDF = async (data: ServiceDetailsPDFData): Promise<Blob> => {
  const doc = new jsPDF();
  const { service } = data;
  
  // 1. Obtener datos de la empresa
  const companyData = await fetchCompanyData();
  
  // 2. Agregar header corporativo
  let yPosition = await addPDFHeader(doc, {
    companyData,
    service: service,
    inspection: {} as any,
    isFinal: true,
    title: 'DETALLES DEL SERVICIO'
  });
  
  // 3. Título del documento
  doc.setFontSize(16);
  doc.setTextColor(...TMS_GREEN);
  doc.text('DETALLES DEL SERVICIO', 20, yPosition);
  yPosition += 10;
  
  // 4. Sección Cliente
  yPosition = addClientSection(doc, service, yPosition);
  
  // 5. Sección Vehículo / referencia
  yPosition = checkPageBreak(doc, yPosition, 40);
  yPosition = addVehicleSection(doc, service, yPosition);
  
  // 6. Sección Información del Servicio
  yPosition = checkPageBreak(doc, yPosition, 60);
  yPosition = addServiceDetailsSection(doc, service, yPosition);
  
  // 7. Sección Custodia/Arriendo (si aplica)
  const isCustody = isCustodyService(service);
  if (isCustody) {
    yPosition = checkPageBreak(doc, yPosition, 50);
    yPosition = addCustodySection(doc, service, yPosition);
  }
  
  // 7.5. Sección Servicio Tercerizado (si aplica)
  if (service.outsourcedProviderId) {
    yPosition = checkPageBreak(doc, yPosition, 40);
    yPosition = addOutsourcedSection(doc, service, yPosition);
  }
  
  // 8. Sección Recursos Asignados
  yPosition = checkPageBreak(doc, yPosition, 40);
  yPosition = addResourcesSection(doc, service, yPosition);
  
  // 8.5. Sección Desglose de Trabajos (si aplica)
  const serviceTypeName = service.serviceType?.name || service.service_type?.name || '';
  if (ITEMS_SERVICE_TYPES.includes(serviceTypeName)) {
    yPosition = checkPageBreak(doc, yPosition, 60);
    yPosition = await addServiceItemsSection(doc, service.id, yPosition);
  }

  // 9. Sección Finanzas
  yPosition = checkPageBreak(doc, yPosition, 70);
  yPosition = addFinancesSection(doc, service, data, yPosition);
  
  // 10. Observaciones (si existen)
  if (service.observations) {
    yPosition = checkPageBreak(doc, yPosition, 30);
    yPosition = addObservationsSection(doc, service.observations, yPosition);
  }
  
  // 11. Footer con timestamps
  addFooter(doc, service);
  
  return doc.output('blob');
};

const checkPageBreak = (doc: jsPDF, yPosition: number, requiredSpace: number): number => {
  if (yPosition + requiredSpace > 270) {
    doc.addPage();
    return 20;
  }
  return yPosition;
};

const addSectionTitle = (doc: jsPDF, title: string, yPosition: number): number => {
  doc.setFontSize(12);
  doc.setTextColor(...TMS_GREEN);
  doc.text(title, 20, yPosition);
  return yPosition + 5;
};

const addClientSection = (doc: jsPDF, service: any, yPosition: number): number => {
  yPosition = addSectionTitle(doc, 'CLIENTE', yPosition);
  
  const clientData = [
    ['Nombre / Razón Social:', service.client.name || 'N/A'],
    ['RUT:', service.client.rut || 'N/A'],
    ['Departamento:', service.client.department || 'N/A'],
    ['Teléfono:', service.client.phone || 'N/A'],
    ['Email:', service.client.email || 'N/A'],
    ['Dirección:', service.client.address || 'N/A']
  ];
  
  autoTable(doc, {
    startY: yPosition,
    body: clientData,
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', fillColor: LIGHT_GRAY },
      1: { cellWidth: 120 }
    },
    styles: { 
      fontSize: 9, 
      cellPadding: 3,
      textColor: [0, 0, 0]
    },
    margin: { left: 20, right: 20 }
  });
  
  return (doc as any).lastAutoTable.finalY + 10;
};

const addVehicleSection = (doc: jsPDF, service: any, yPosition: number): number => {
  yPosition = addSectionTitle(doc, 'VEHÍCULO', yPosition);

  const vehicleData = [['Referencia visible:', formatVehicleInfo(service)]];

  if (shouldShowVehicleInfo(service)) {
    vehicleData.push(
      ['Marca y Modelo:', `${service.vehicleBrand} ${service.vehicleModel}`],
      ['Patente:', service.licensePlate || 'N/A']
    );
  }
  
  autoTable(doc, {
    startY: yPosition,
    body: vehicleData,
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', fillColor: LIGHT_GRAY },
      1: { cellWidth: 120 }
    },
    styles: { 
      fontSize: 9, 
      cellPadding: 3,
      textColor: [0, 0, 0]
    },
    margin: { left: 20, right: 20 }
  });
  
  return (doc as any).lastAutoTable.finalY + 10;
};

const addServiceDetailsSection = (doc: jsPDF, service: any, yPosition: number): number => {
  yPosition = addSectionTitle(doc, 'INFORMACIÓN DEL SERVICIO', yPosition);
  
  const serviceData: Array<[string, string]> = [
    ['Tipo de Servicio:', service.serviceType?.name || service.service_type?.name || 'N/A'],
    ['Fecha de Solicitud:', formatForDisplay(service.requestDate)],
    ['Fecha y Hora de Servicio:', formatForDisplayWithTime(service.serviceDate)],
    ['Origen:', service.origin || 'N/A'],
    ['Destino:', service.destination || 'N/A']
  ];
  
  if (service.purchaseOrderNumber || service.purchaseOrder) {
    serviceData.push(['Orden de Compra:', service.purchaseOrderNumber || service.purchaseOrder]);
  }
  
  if (service.quoteNumber) {
    serviceData.push(['Número de Cotización:', service.quoteNumber]);
  }
  
  if (service.invoiceFolio) {
    serviceData.push(['Folio Factura:', service.invoiceFolio]);
  }
  
  if (service.invoiceNumeroFiscal) {
    serviceData.push(['Número Fiscal:', service.invoiceNumeroFiscal]);
  }
  
  autoTable(doc, {
    startY: yPosition,
    body: serviceData,
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', fillColor: LIGHT_GRAY },
      1: { cellWidth: 120 }
    },
    styles: { 
      fontSize: 9, 
      cellPadding: 3,
      textColor: [0, 0, 0]
    },
    margin: { left: 20, right: 20 }
  });
  
  return (doc as any).lastAutoTable.finalY + 10;
};

const addCustodySection = (doc: jsPDF, service: any, yPosition: number): number => {
  const custodyInfo = getCustodyInfo(service);
  const isEquipmentRental = isEquipmentRentalService(service);
  
  if (!custodyInfo) return yPosition;
  
  yPosition = addSectionTitle(
    doc, 
    isEquipmentRental ? 'INFORMACIÓN DE ARRIENDO' : 'INFORMACIÓN DE CUSTODIA', 
    yPosition
  );
  
  const custodyData: Array<[string, string]> = [
    [
      isEquipmentRental ? 'Tipo de Equipo:' : 'Tipo de Vehículo:', 
      custodyInfo.vehicleType || 'N/A'
    ],
    [
      isEquipmentRental ? 'Días de Arriendo:' : 'Días de Custodia:', 
      String(custodyInfo.days || 0)
    ],
    [
      custodyInfo.rateType === 'weekly' ? 'Tarifa Semanal:' :
      custodyInfo.rateType === 'monthly' ? 'Tarifa Mensual:' :
      'Tarifa Diaria:',
      formatCurrency(custodyInfo.originalRate)
    ]
  ];
  
  if (custodyInfo.discountPercentage > 0) {
    custodyData.push(['Descuento:', `${custodyInfo.discountPercentage}%`]);
  }
  
  custodyData.push([
    isEquipmentRental ? 'Total Arriendo:' : 'Total Custodia:',
    formatCurrency(custodyInfo.totalAmount)
  ]);
  
  if (custodyInfo.startDate) {
    custodyData.push(['Fecha Inicio:', formatForDisplay(custodyInfo.startDate)]);
  }
  
  if (custodyInfo.endDate) {
    custodyData.push(['Fecha Fin:', formatForDisplay(custodyInfo.endDate)]);
  }
  
  if (custodyInfo.notes) {
    custodyData.push(['Notas:', custodyInfo.notes]);
  }
  
  autoTable(doc, {
    startY: yPosition,
    body: custodyData,
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', fillColor: LIGHT_GRAY },
      1: { cellWidth: 120 }
    },
    styles: { 
      fontSize: 9, 
      cellPadding: 3,
      textColor: [0, 0, 0]
    },
    margin: { left: 20, right: 20 }
  });
  
  return (doc as any).lastAutoTable.finalY + 10;
};

const addOutsourcedSection = (doc: jsPDF, service: any, yPosition: number): number => {
  yPosition = addSectionTitle(doc, 'SERVICIO TERCERIZADO', yPosition);
  
  const outsourcedData: Array<[string, string]> = [
    ['Proveedor Tercero:', service.outsourcedProviderName || service.outsourcedProviderId || 'N/A'],
    ['Costo del Tercero:', formatCurrency(service.outsourcedCost || 0)]
  ];
  
  if (service.outsourcedNotes) {
    outsourcedData.push(['Notas:', service.outsourcedNotes]);
  }
  
  autoTable(doc, {
    startY: yPosition,
    body: outsourcedData,
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', fillColor: LIGHT_GRAY },
      1: { cellWidth: 120 }
    },
    styles: { 
      fontSize: 9, 
      cellPadding: 3,
      textColor: [0, 0, 0]
    },
    margin: { left: 20, right: 20 }
  });
  
  return (doc as any).lastAutoTable.finalY + 10;
};

const addResourcesSection = (doc: jsPDF, service: any, yPosition: number): number => {
  yPosition = addSectionTitle(doc, 'RECURSOS ASIGNADOS', yPosition);
  
  const getPrimaryOperator = () => {
    if (service.operators && service.operators.length > 0) {
      const primaryOperator = service.operators.find((op: any) => op.role === 'Principal') || service.operators[0];
      return primaryOperator.operator;
    }
    return service.operator;
  };
  
  const primaryOperator = getPrimaryOperator();
  const hasMultipleOperators = service.operators && service.operators.length > 1;
  
  const resourcesData: Array<[string, string]> = [
    [
      'Grúa:', 
      service.crane ? 
        `${service.crane.brand} ${service.crane.model} (${service.crane.licensePlate})` : 
        'Sin asignar'
    ],
    [
      'Operador:', 
      primaryOperator ? 
        `${primaryOperator.name} (${primaryOperator.rut})${hasMultipleOperators ? ' (Principal)' : ''}` : 
        'Sin asignar'
    ]
  ];
  
  // Agregar operadores adicionales si existen
  if (hasMultipleOperators) {
    service.operators.forEach((op: any, index: number) => {
      if (op.role !== 'Principal' && op.operator) {
        resourcesData.push([
          `Operador ${index + 1} (${op.role || 'Auxiliar'}):`,
          `${op.operator.name} (${op.operator.rut})`
        ]);
      }
    });
  }
  
  autoTable(doc, {
    startY: yPosition,
    body: resourcesData,
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', fillColor: LIGHT_GRAY },
      1: { cellWidth: 120 }
    },
    styles: { 
      fontSize: 9, 
      cellPadding: 3,
      textColor: [0, 0, 0]
    },
    margin: { left: 20, right: 20 }
  });
  
  return (doc as any).lastAutoTable.finalY + 10;
};

const addFinancesSection = (doc: jsPDF, service: any, data: ServiceDetailsPDFData, yPosition: number): number => {
  yPosition = addSectionTitle(doc, 'FINANZAS', yPosition);
  
  const displayServiceValue = getDisplayServiceValue(service);
  const serviceBreakdown = getServiceValueBreakdown(service);
  const isCustody = isCustodyService(service);
  
  const financesData: Array<[string, string]> = [];
  
  // Mostrar desglose si hay tanto valor base como custodia
  if (serviceBreakdown.hasBothValues) {
    financesData.push(
      ['Valor Base del Servicio:', formatCurrency(serviceBreakdown.baseValue)],
      ['Valor de Custodia/Arriendo:', formatCurrency(serviceBreakdown.custodyValue)],
      ['Valor Total del Servicio:', formatCurrency(displayServiceValue)]
    );
  } else {
    financesData.push([
      isCustody ? 'Valor Total Servicio:' : 'Valor del Servicio:',
      formatCurrency(displayServiceValue)
    ]);
  }
  
  // Agregar excedentes si existen
  if (service.hasExcess) {
    financesData.push(
      ['Monto Cubierto por Cliente:', formatCurrency(service.clientCoveredAmount || 0)],
      ['Monto del Excedente:', formatCurrency(service.excessAmount || 0)]
    );
  }
  
  // Agregar costos y comisiones
  financesData.push(
    ['Total Costos del Servicio:', formatCurrency(data.totalCosts - data.totalCommissions)],
    ['Total Comisiones:', formatCurrency(data.totalCommissions)],
    ['Total Costos y Comisiones:', formatCurrency(data.totalCosts)],
    ['Ganancia Neta:', formatCurrency(data.netProfit)]
  );
  
  autoTable(doc, {
    startY: yPosition,
    body: financesData,
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 90, fontStyle: 'bold', fillColor: LIGHT_GRAY },
      1: { cellWidth: 80, halign: 'right', fontStyle: 'bold' }
    },
    styles: { 
      fontSize: 9, 
      cellPadding: 3,
      textColor: [0, 0, 0]
    },
    didParseCell: function(data) {
      // Destacar la ganancia neta
      if (data.row.index === financesData.length - 1) {
        data.cell.styles.fillColor = TMS_GREEN;
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontSize = 10;
      }
    },
    margin: { left: 20, right: 20 }
  });
  
  return (doc as any).lastAutoTable.finalY + 10;
};

const addObservationsSection = (doc: jsPDF, observations: string, yPosition: number): number => {
  yPosition = addSectionTitle(doc, 'OBSERVACIONES', yPosition);
  
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  
  const lines = doc.splitTextToSize(observations, 170);
  doc.text(lines, 20, yPosition);
  
  return yPosition + (lines.length * 5) + 10;
};

const addFooter = (doc: jsPDF, service: any): void => {
  const pageCount = (doc as any).internal.getNumberOfPages();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    
    // Timestamps
    const createdAt = service.created_at ? 
      `Creado: ${formatForDisplayWithTime(service.created_at)}` : '';
    const updatedAt = service.updated_at ? 
      `Actualizado: ${formatForDisplayWithTime(service.updated_at)}` : '';
    
    doc.text(`${createdAt}  |  ${updatedAt}`, 20, 285);
    
    // Número de página
    doc.text(`Página ${i} de ${pageCount}`, 170, 285);
  }
};
