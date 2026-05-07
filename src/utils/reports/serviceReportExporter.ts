
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExportServiceReportArgs } from './reportTypes';
import { createExportFileName, addCompanyHeader } from './reportUtils';
import { getDisplayServiceValue, getServiceValueBreakdown } from '../serviceValueCalculations';
import { isEquipmentRentalService } from '../serviceValueCalculations';
import { getCustodyDisplayInfo } from '../custodyCalculations';
import { Service } from '@/types';
import { defaultReportColumnConfig, ColumnKey, columnOrder, ReportColumnsConfig } from '@/types/reportColumnConfig';

// Función para obtener el valor de una columna dado un servicio
const getColumnValue = (service: Service, key: ColumnKey, config: ReportColumnsConfig): string => {
  // Calcular maxChars dinámicamente basado en el ancho configurado
  const columnWidth = config.columns[key].width;
  const maxChars = Math.max(5, Math.floor(columnWidth * 1.8));
  
  switch (key) {
    case 'fecha':
      return formatDate(new Date(service.serviceDate + 'T00:00:00'), 'dd/MM/yy');
    case 'folio':
      return service.folio;
    case 'cliente':
      return truncate(service.client?.name || 'N/A', maxChars);
    case 'asegurado':
      return truncate((service as any).insuredName || '-', maxChars);
    case 'cotizacion':
      return truncate(service.quoteNumber || '-', maxChars);
    case 'oc':
      return truncate(service.purchaseOrder || '-', maxChars);
    case 'factura':
      return truncate(service.invoiceFolio || '-', maxChars);
    case 'tipoServicio':
      return truncate(service.serviceType?.name || 'N/A', maxChars);
    case 'patente':
      return service.licensePlate || 'N/A';
    case 'origen':
      return truncate(service.origin || 'N/A', maxChars);
    case 'destino':
      return truncate(service.destination || 'N/A', maxChars);
    case 'estado':
      return service.status;
    case 'valorBase': {
      const breakdownBase = getServiceValueBreakdown(service);
      return breakdownBase.baseValue > 0 
        ? `$${breakdownBase.baseValue.toLocaleString('es-CL')}` 
        : '-';
    }
    case 'custodiaInicio':
      return (service as any).custodyStartDate 
        ? formatDate(new Date((service as any).custodyStartDate + 'T00:00:00'), 'dd/MM/yy') 
        : '-';
    case 'custodiaFin':
      return (service as any).custodyEndDate 
        ? formatDate(new Date((service as any).custodyEndDate + 'T00:00:00'), 'dd/MM/yy') 
        : '-';
    case 'custodiaDias':
      return (service as any).custodyDays > 0 
        ? (service as any).custodyDays.toString() 
        : '-';
    case 'valorCustodia': {
      const breakdownCustody = getServiceValueBreakdown(service);
      return breakdownCustody.custodyValue > 0 
        ? `$${breakdownCustody.custodyValue.toLocaleString('es-CL')}` 
        : '-';
    }
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
  
  // Usar configuración proporcionada, mezclando con defaults para columnas faltantes
  const config: ReportColumnsConfig = {
    columns: {
      ...defaultReportColumnConfig.columns,
      ...(reportColumnConfig?.columns || {})
    }
  };
  
  // Obtener solo las columnas visibles en el orden correcto (con fallback para columnas faltantes)
  const visibleColumns = columnOrder.filter(key => {
    const columnConfig = config.columns[key];
    return columnConfig?.visible ?? false;
  });
  
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
        visibleColumns.map(key => getColumnValue(service, key, config))
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

      // Sección dedicada: Detalle de Arriendos de Equipos
      const rentalServices = sortedServices.filter(s => isEquipmentRentalService(s));
      if (rentalServices.length > 0) {
        const rentalStartY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.text('Detalle de Arriendos de Equipos', 14, rentalStartY);

        const rentalBody = rentalServices.map(s => {
          const info = getCustodyDisplayInfo(s) || ({} as any);
          const dailyRate = info.dailyRate || 0;
          const total = (s as any).custodyTotalAmount || (s as any).custody_total_amount || 0;
          return [
            formatDate(new Date(s.serviceDate + 'T00:00:00'), 'dd/MM/yy'),
            s.folio,
            info.vehicleType || '-',
            info.startDate ? formatDate(new Date(info.startDate + 'T00:00:00'), 'dd/MM/yy') : '-',
            info.endDate ? formatDate(new Date(info.endDate + 'T00:00:00'), 'dd/MM/yy') : '-',
            (info.days ?? 0).toString(),
            dailyRate > 0 ? `$${Math.round(dailyRate).toLocaleString('es-CL')}` : '-',
            total > 0 ? `$${total.toLocaleString('es-CL')}` : '-',
          ];
        });

        autoTable(doc, {
          head: [['Fecha', 'Folio', 'Tipo de Equipo', 'Inicio', 'Fin', 'Días', 'Tarifa Diaria', 'Total Arriendo']],
          body: rentalBody,
          startY: rentalStartY + 4,
          headStyles: { fillColor: [139, 92, 246], fontSize: 8 },
          styles: { fontSize: 7, cellPadding: 1.5 },
        });
      }

      console.log('✅ [PDF Export] PDF generado exitosamente');
      doc.save(`${exportFileDefaultName}.pdf`);
    } catch (error) {
      console.error('❌ [PDF Export] Error generando PDF:', error);
      throw new Error(`Error al generar PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }

  } else if (format === 'excel') {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Hoja principal: Detalle completo de servicios - con Asegurado y desglose de valores
    const services_data = sortedServices.map(s => {
      const breakdown = getServiceValueBreakdown(s);
      return {
        'Fecha Servicio': formatDate(new Date(s.serviceDate + 'T00:00:00'), 'yyyy-MM-dd'),
        'Hora Inicio': s.startTime || '-',
        'Hora Término': s.endTime || '-',
        'Kilómetros Recorridos': s.craneMileage || '-',
        'Folio': s.folio,
        'Cliente': s.client?.name || 'N/A',
        'RUT Cliente': s.client?.rut || 'N/A',
        'Asegurado': (s as any).insuredName || '-',
        'Cotización': s.quoteNumber || '-',
        'Orden de Compra': s.purchaseOrder || '-',
        'Factura': s.invoiceFolio || '-',
        'Número Fiscal': s.invoiceNumeroFiscal || '-',
        'Tipo de Servicio': s.serviceType?.name || 'N/A',
        'Marca Vehículo': s.vehicleBrand || 'N/A',
        'Modelo Vehículo': s.vehicleModel || 'N/A',
        'Patente Vehículo': s.licensePlate || 'N/A',
        'Origen': s.origin || 'N/A',
        'Destino': s.destination || 'N/A',
        'Patente Grúa': s.crane?.licensePlate || 'N/A',
        'Estado': s.status,
        'Valor Servicio': breakdown.baseValue,
        'Inicio Custodia': (s as any).custodyStartDate || '-',
        'Fin Custodia': (s as any).custodyEndDate || '-',
        'Días Custodia': (s as any).custodyDays || 0,
        'Valor Custodia': breakdown.custodyValue,
        'Valor Total': getDisplayServiceValue(s),
        'Observaciones': s.observations,
      };
    });
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

    // Hoja adicional: Arriendos de Equipos
    const rentalServices = sortedServices.filter(s => isEquipmentRentalService(s));
    if (rentalServices.length > 0) {
      const rental_data = rentalServices.map(s => {
        const info = getCustodyDisplayInfo(s) || ({} as any);
        const dailyRate = info.dailyRate || 0;
        const total = (s as any).custodyTotalAmount || (s as any).custody_total_amount || 0;
        return {
          'Fecha': formatDate(new Date(s.serviceDate + 'T00:00:00'), 'yyyy-MM-dd'),
          'Folio': s.folio,
          'Cliente': s.client?.name || 'N/A',
          'Tipo de Equipo': info.vehicleType || '-',
          'Fecha Inicio': info.startDate || '-',
          'Fecha Fin': info.endDate || '-',
          'Días': info.days ?? 0,
          'Tarifa Diaria': Math.round(dailyRate),
          'Total Arriendo': total,
        };
      });
      const rental_ws = XLSX.utils.json_to_sheet(rental_data);
      XLSX.utils.book_append_sheet(wb, rental_ws, 'Arriendos de Equipos');
    }

    XLSX.writeFile(wb, `${exportFileDefaultName}.xlsx`);
  }
};
