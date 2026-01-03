
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExportServiceReportArgs } from './reportTypes';
import { createExportFileName, addCompanyHeader } from './reportUtils';
import { getDisplayServiceValue } from '../serviceValueCalculations';
import { Service } from '@/types';
import { defaultReportColumnConfig, ColumnKey, columnOrder, ReportColumnsConfig } from '@/types/reportColumnConfig';

// Función para obtener el valor de una columna dado un servicio
const getColumnValue = (service: Service, key: ColumnKey): string => {
  switch (key) {
    case 'fecha':
      return formatDate(new Date(service.serviceDate + 'T00:00:00'), 'dd/MM/yy');
    case 'folio':
      return service.folio;
    case 'cliente':
      return truncate(service.client.name, 14);
    case 'asegurado':
      return truncate((service as any).insuredName || '-', 14);
    case 'cotizacion':
      return truncate(service.quoteNumber || '-', 8);
    case 'oc':
      return truncate(service.purchaseOrder || '-', 6);
    case 'factura':
      return truncate(service.invoiceFolio || '-', 5);
    case 'tipoServicio':
      return truncate(service.serviceType.name, 8);
    case 'patente':
      return service.licensePlate || 'N/A';
    case 'origen':
      return truncate(service.origin || 'N/A', 10);
    case 'destino':
      return truncate(service.destination || 'N/A', 10);
    case 'estado':
      return service.status;
    case 'valor':
      return `$${getDisplayServiceValue(service).toLocaleString('es-CL')}`;
    default:
      return '-';
  }
};

const truncate = (str: string, maxLength: number): string => {
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
};

export const exportServiceReport = async ({ 
  format, 
  services, 
  settings, 
  appliedFilters, 
  logoUrl, 
  customFileName,
  reportColumnConfig 
}: ExportServiceReportArgs & { customFileName?: string }) => {
  const { company } = settings;
  const exportFileDefaultName = customFileName || createExportFileName('informe-servicios', appliedFilters.dateRange.from, appliedFilters.dateRange.to);
  
  // Usar configuración proporcionada o valores por defecto
  const config = reportColumnConfig || defaultReportColumnConfig;
  
  // Obtener solo las columnas visibles en el orden correcto
  const visibleColumns = columnOrder.filter(key => config.columns[key].visible);
  
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
      console.log('📄 [PDF Export] Columnas visibles:', visibleColumns.length);
      
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

      // Generar headers dinámicamente basado en columnas visibles
      const headers = visibleColumns.map(key => config.columns[key].label);
      
      // Generar body dinámicamente
      const body = sortedServices.map(service => 
        visibleColumns.map(key => getColumnValue(service, key))
      );

      // Calcular anchos de columnas proporcionalmente
      const totalWidth = visibleColumns.reduce((sum, key) => sum + config.columns[key].width, 0);
      const availableWidth = pageWidth - 28;
      
      const columnStyles: Record<number, { cellWidth: number }> = {};
      visibleColumns.forEach((key, index) => {
        const widthPercent = config.columns[key].width / totalWidth;
        columnStyles[index] = { cellWidth: availableWidth * widthPercent };
      });

      autoTable(doc, {
        head: [headers],
        body,
        startY: lastY + 10,
        headStyles: { fillColor: [41, 128, 185], fontSize: 7 },
        styles: { fontSize: 6, cellPadding: 1 },
        tableWidth: availableWidth,
        columnStyles
      });
      
      console.log('✅ [PDF Export] PDF generado exitosamente');
      doc.save(`${exportFileDefaultName}.pdf`);
    } catch (error) {
      console.error('❌ [PDF Export] Error generando PDF:', error);
      throw new Error(`Error al generar PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }

  } else if (format === 'excel') {
    const wb = XLSX.utils.book_new();

    // Hoja principal: Detalle completo de servicios - con Asegurado
    const services_data = sortedServices.map(s => ({
      'Fecha Servicio': formatDate(new Date(s.serviceDate + 'T00:00:00'), 'yyyy-MM-dd'),
      'Hora Inicio': s.startTime || '-',
      'Hora Término': s.endTime || '-',
      'Kilómetros Recorridos': s.craneMileage || '-',
      'Folio': s.folio,
      'Cliente': s.client.name,
      'RUT Cliente': s.client.rut,
      'Asegurado': (s as any).insuredName || '-',
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
