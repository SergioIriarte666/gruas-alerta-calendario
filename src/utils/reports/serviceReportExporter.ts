
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExportServiceReportArgs } from './reportTypes';
import { createExportFileName, addCompanyHeader } from './reportUtils';
import { getDisplayServiceValue } from '../serviceValueCalculations';

export const exportServiceReport = async ({ format, services, settings, appliedFilters, logoUrl, customFileName }: ExportServiceReportArgs & { customFileName?: string }) => {
  const { company } = settings;
  const exportFileDefaultName = customFileName || createExportFileName('informe-servicios', appliedFilters.dateRange.from, appliedFilters.dateRange.to);
  
  // Ordenar servicios por fecha (más antiguas primero)
  const sortedServices = [...services].sort((a, b) => {
    const dateA = new Date(a.serviceDate + 'T00:00:00').getTime();
    const dateB = new Date(b.serviceDate + 'T00:00:00').getTime();
    return dateA - dateB;
  });
  
  const totalValue = sortedServices.reduce((acc, service) => {
    return acc + getDisplayServiceValue(service);
  }, 0);

  if (format === 'pdf') {
    try {
      console.log('📄 [PDF Export] Iniciando generación de PDF con', services.length, 'servicios');
      console.log('📄 [PDF-EXPORT] Generando PDF con logo:', logoUrl);
      
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;
      let startY = await addCompanyHeader(doc, company, 15, logoUrl);

    doc.setFontSize(14);
    doc.text('Informe de Servicios', 14, startY);
    startY += 10;
    
    const filterLabels = [
      ['Período', `${formatDate(new Date(appliedFilters.dateRange.from + 'T00:00:00'), 'P', { locale: es })} - ${formatDate(new Date(appliedFilters.dateRange.to + 'T00:00:00'), 'P', { locale: es })}`],
      ['Cliente', appliedFilters.client]
    ];
    doc.setFontSize(11);
    autoTable(doc, { body: filterLabels, startY, theme: 'plain', styles: { fontSize: 9 } });

    let lastY = (doc as any).lastAutoTable.finalY;

    const summaryData = [
      ['Total Servicios', sortedServices.length.toString()],
      ['Valor Total', `$${totalValue.toLocaleString('es-CL')}`]
    ];
    doc.setFontSize(11);
    autoTable(doc, { head: [['Resumen', '']], body: summaryData, startY: lastY + 5, theme: 'grid' });
    lastY = (doc as any).lastAutoTable.finalY;

    // Tabla optimizada - SIN operador, con origen-destino más claro
    const availableWidth = pageWidth - 28; // Márgenes izquierdo y derecho
    autoTable(doc, {
      head: [['Fecha', 'Folio', 'Cliente', 'Cotización', 'OC', 'Factura', 'Tipo Servicio', 'Marca Veh.', 'Modelo Veh.', 'Patente Veh.', 'Origen', 'Destino', 'Estado', 'Valor']],
      body: sortedServices.map(s => [
        formatDate(new Date(s.serviceDate + 'T00:00:00'), 'dd/MM/yy'),
        s.folio,
        s.client.name.length > 10 ? s.client.name.substring(0, 10) + '...' : s.client.name,
        (s.quoteNumber || '-').length > 8 ? (s.quoteNumber || '-').substring(0, 8) + '...' : (s.quoteNumber || '-'),
        (s.purchaseOrder || '-').length > 10 ? (s.purchaseOrder || '-').substring(0, 10) + '...' : (s.purchaseOrder || '-'),
        (s.invoiceFolio || '-').length > 8 ? (s.invoiceFolio || '-').substring(0, 8) + '...' : (s.invoiceFolio || '-'),
        s.serviceType.name.length > 8 ? s.serviceType.name.substring(0, 8) + '...' : s.serviceType.name,
        (s.vehicleBrand || 'N/A').length > 6 ? (s.vehicleBrand || 'N/A').substring(0, 6) + '...' : (s.vehicleBrand || 'N/A'),
        (s.vehicleModel || 'N/A').length > 6 ? (s.vehicleModel || 'N/A').substring(0, 6) + '...' : (s.vehicleModel || 'N/A'),
        s.licensePlate || 'N/A',
        (s.origin || 'N/A').length > 12 ? (s.origin || 'N/A').substring(0, 12) + '...' : (s.origin || 'N/A'),
        (s.destination || 'N/A').length > 12 ? (s.destination || 'N/A').substring(0, 12) + '...' : (s.destination || 'N/A'),
        s.status,
        `$${getDisplayServiceValue(s).toLocaleString('es-CL')}`
      ]),
      startY: lastY + 10,
      headStyles: { fillColor: [41, 128, 185], fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 1.5 },
      tableWidth: availableWidth,
      columnStyles: {
        0: { cellWidth: availableWidth * 0.06 },  // Fecha - 6%
        1: { cellWidth: availableWidth * 0.06 },  // Folio - 6%
        2: { cellWidth: availableWidth * 0.09 },  // Cliente - 9%
        3: { cellWidth: availableWidth * 0.06 },  // Cotización - 6%
        4: { cellWidth: availableWidth * 0.07 },  // OC - 7%
        5: { cellWidth: availableWidth * 0.06 },  // Factura - 6%
        6: { cellWidth: availableWidth * 0.07 },  // Tipo Servicio - 7%
        7: { cellWidth: availableWidth * 0.06 },  // Marca Veh. - 6%
        8: { cellWidth: availableWidth * 0.06 },  // Modelo Veh. - 6%
        9: { cellWidth: availableWidth * 0.07 },  // Patente Veh. - 7%
        10: { cellWidth: availableWidth * 0.11 }, // Origen - 11%
        11: { cellWidth: availableWidth * 0.11 }, // Destino - 11%
        12: { cellWidth: availableWidth * 0.05 }, // Estado - 5%
        13: { cellWidth: availableWidth * 0.07 }  // Valor - 7%
      }
    });
    
      console.log('✅ [PDF Export] PDF generado exitosamente');
      doc.save(`${exportFileDefaultName}.pdf`);
    } catch (error) {
      console.error('❌ [PDF Export] Error generando PDF:', error);
      throw new Error(`Error al generar PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }

  } else if (format === 'excel') {
    const wb = XLSX.utils.book_new();

    // Hoja principal: Detalle completo de servicios - SIN operador
    const services_data = sortedServices.map(s => ({
      'Fecha Servicio': formatDate(new Date(s.serviceDate + 'T00:00:00'), 'yyyy-MM-dd'),
      'Hora Inicio': s.startTime || '-',
      'Hora Término': s.endTime || '-',
      'Kilómetros Recorridos': s.craneMileage || '-',
      'Folio': s.folio,
      'Cliente': s.client.name,
      'RUT Cliente': s.client.rut,
      'Cotización': s.quoteNumber || '-',
      'Orden de Compra': s.purchaseOrder || '-',
      'Factura': s.invoiceFolio || '-',
      'Número Fiscal': s.invoiceNumeroFiscal || '-',
      'Tipo de Servicio': s.serviceType.name,
      'Marca Vehículo': s.vehicleBrand || 'N/A',
      'Modelo Vehículo': s.vehicleModel || 'N/A',
      'Patente Vehículo': s.licensePlate || 'N/A',
      'Origen': s.origin || 'N/A',
      'Destino': s.destination || 'N/A',
      'Patente Grúa': s.crane.licensePlate || 'N/A',
      'Estado': s.status,
      'Valor': getDisplayServiceValue(s),
      'Observaciones': s.observations,
    }));
    const services_ws = XLSX.utils.json_to_sheet(services_data);
    XLSX.utils.book_append_sheet(wb, services_ws, 'Detalle de Servicios');

    // Hoja secundaria: Resumen
    const summary_ws_data = [
      [company.name],
      ['Informe de Servicios'], [],
      ['Filtros Aplicados'],
      ['Período', `${formatDate(new Date(appliedFilters.dateRange.from + 'T00:00:00'), 'P', { locale: es })} a ${formatDate(new Date(appliedFilters.dateRange.to + 'T00:00:00'), 'P', { locale: es })}`],
      ['Cliente', appliedFilters.client], [],
      ['Resumen'],
      ['Métrica', 'Valor'],
      ['Total Servicios', sortedServices.length],
      ['Valor Total', totalValue],
    ];
    const summary_ws = XLSX.utils.aoa_to_sheet(summary_ws_data);
    XLSX.utils.book_append_sheet(wb, summary_ws, 'Resumen');

    XLSX.writeFile(wb, `${exportFileDefaultName}.xlsx`);
  }
};
