
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExportServiceReportArgs } from './reportTypes';
import { createExportFileName, addCompanyHeader } from './reportUtils';
import { sendBlobToDownloadWindow } from './downloadWindow';
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

const parseReportDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00`
    : value;
  const parsedDate = new Date(normalizedValue);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const formatReportDate = (value: unknown, pattern: string): string => {
  const parsedDate = parseReportDate(value);
  return parsedDate ? formatDate(parsedDate, pattern) : '-';
};

const formatCurrency = (value: unknown): string => {
  const numericValue = typeof value === 'number' ? value : Number(value || 0);
  return numericValue > 0 ? `$${Math.round(numericValue).toLocaleString('es-CL')}` : '-';
};

type EquipmentRentalExportRow = {
  pdfRow: string[];
  excelRow: Record<string, string | number>;
};

const buildEquipmentRentalExportRows = (services: Service[]): EquipmentRentalExportRow[] => {
  return services
    .filter(service => isEquipmentRentalService(service))
    .map(service => {
      const info = getCustodyDisplayInfo(service);
      const totalAmount = info?.totalAmount ?? (service as any).custodyTotalAmount ?? (service as any).custody_total_amount ?? 0;
      const rawDays = info?.days ?? (service as any).custodyDays ?? (service as any).custody_days ?? 0;
      const rentalDays = typeof rawDays === 'number' ? rawDays : Number(rawDays || 0);
      const vehicleType = info?.vehicleType || (service as any).custodyVehicleType || (service as any).custody_vehicle_type || '-';
      const startDate = info?.startDate || (service as any).custodyStartDate || (service as any).custody_start_date;
      const endDate = info?.endDate || (service as any).custodyEndDate || (service as any).custody_end_date;
      const dailyRate = info?.dailyRate ?? 0;

      return {
        pdfRow: [
          formatReportDate(service.serviceDate, 'dd/MM/yy'),
          service.folio || '-',
          vehicleType,
          formatReportDate(startDate, 'dd/MM/yy'),
          formatReportDate(endDate, 'dd/MM/yy'),
          rentalDays > 0 ? rentalDays.toString() : '-',
          formatCurrency(dailyRate),
          formatCurrency(totalAmount),
        ],
        excelRow: {
          'Fecha': formatReportDate(service.serviceDate, 'yyyy-MM-dd'),
          'Folio': service.folio || '-',
          'Cliente': service.client?.name || 'N/A',
          'Tipo de Equipo': vehicleType,
          'Fecha Inicio': formatReportDate(startDate, 'yyyy-MM-dd'),
          'Fecha Fin': formatReportDate(endDate, 'yyyy-MM-dd'),
          'Días': rentalDays > 0 ? rentalDays : '-',
          'Tarifa Diaria': Math.round(typeof dailyRate === 'number' ? dailyRate : Number(dailyRate || 0)),
          'Total Arriendo': Math.round(typeof totalAmount === 'number' ? totalAmount : Number(totalAmount || 0)),
        }
      };
    });
};

export const exportServiceReport = async ({ 
  format, 
  services, 
  settings, 
  appliedFilters, 
  logoUrl, 
  customFileName,
  reportColumnConfig,
  downloadWindow 
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

      // Mantiene el detalle adicional aislado para no afectar la descarga principal.
      const rentalRows = buildEquipmentRentalExportRows(sortedServices);
      if (rentalRows.length > 0) {
        try {
          const rentalStartY = (doc as any).lastAutoTable.finalY + 10;
          doc.setFontSize(12);
          doc.text('Detalle de Arriendos de Equipos', 14, rentalStartY);

          autoTable(doc, {
            head: [['Fecha', 'Folio', 'Tipo de Equipo', 'Inicio', 'Fin', 'Días', 'Tarifa Diaria', 'Total Arriendo']],
            body: rentalRows.map(row => row.pdfRow),
            startY: rentalStartY + 4,
            headStyles: { fillColor: [139, 92, 246], fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 1.5 },
          });
        } catch (rentalSectionError) {
          console.warn('⚠️ [PDF Export] No se pudo generar el detalle de arriendos:', rentalSectionError);
        }
      }

      console.log('✅ [PDF Export] PDF generado exitosamente');
      const pdfBlob = doc.output('blob');
      if (sendBlobToDownloadWindow(downloadWindow, pdfBlob, `${exportFileDefaultName}.pdf`)) {
        return;
      }

      try {
        doc.save(`${exportFileDefaultName}.pdf`);
      } catch (saveError) {
        console.error('❌ [PDF Export] doc.save falló, usando descarga alternativa:', saveError);
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const pdfLink = document.createElement('a');
        pdfLink.href = pdfUrl;
        pdfLink.download = `${exportFileDefaultName}.pdf`;
        pdfLink.target = '_blank';
        pdfLink.rel = 'noopener noreferrer';
        pdfLink.style.display = 'none';
        document.body.appendChild(pdfLink);
        pdfLink.click();
        setTimeout(() => {
          document.body.removeChild(pdfLink);
          URL.revokeObjectURL(pdfUrl);
        }, 100);
      }
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

    const rentalRows = buildEquipmentRentalExportRows(sortedServices);
    if (rentalRows.length > 0) {
      try {
        const rental_ws = XLSX.utils.json_to_sheet(rentalRows.map(row => row.excelRow));
        XLSX.utils.book_append_sheet(wb, rental_ws, 'Arriendos de Equipos');
      } catch (rentalSheetError) {
        console.warn('⚠️ [Excel Export] No se pudo generar la hoja de arriendos:', rentalSheetError);
      }
    }

    const xlsxArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const xlsxBlob = new Blob([xlsxArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    if (sendBlobToDownloadWindow(downloadWindow, xlsxBlob, `${exportFileDefaultName}.xlsx`)) {
      return;
    }

    try {
      XLSX.writeFile(wb, `${exportFileDefaultName}.xlsx`);
    } catch (writeError) {
      console.error('❌ [Excel Export] XLSX.writeFile falló, usando descarga alternativa:', writeError);
      const xlsxUrl = URL.createObjectURL(xlsxBlob);
      const xlsxLink = document.createElement('a');
      xlsxLink.href = xlsxUrl;
      xlsxLink.download = `${exportFileDefaultName}.xlsx`;
      xlsxLink.target = '_blank';
      xlsxLink.rel = 'noopener noreferrer';
      xlsxLink.style.display = 'none';
      document.body.appendChild(xlsxLink);
      xlsxLink.click();
      setTimeout(() => {
        document.body.removeChild(xlsxLink);
        URL.revokeObjectURL(xlsxUrl);
      }, 100);
    }
  }
};
