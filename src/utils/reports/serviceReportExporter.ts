
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExportServiceReportArgs } from './reportTypes';
import { createExportFileName, addCompanyHeader } from './reportUtils';

export const exportServiceReport = async ({ format, services, settings, appliedFilters }: ExportServiceReportArgs) => {
  const { company } = settings;
  const exportFileDefaultName = createExportFileName('informe-servicios', appliedFilters.dateRange.from, appliedFilters.dateRange.to);
  
  const totalValue = services.reduce((acc, service) => acc + (service.value || 0), 0);

  if (format === 'pdf') {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    let startY = await addCompanyHeader(doc, company, 15);

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
      ['Total Servicios', services.length.toString()],
      ['Valor Total', `$${totalValue.toLocaleString('es-CL')}`]
    ];
    doc.setFontSize(11);
    autoTable(doc, { head: [['Resumen', '']], body: summaryData, startY: lastY + 5, theme: 'grid' });
    lastY = (doc as any).lastAutoTable.finalY;

    // Tabla optimizada para usar todo el ancho disponible - SIN grúa y operador
    const availableWidth = pageWidth - 28; // Márgenes izquierdo y derecho
    autoTable(doc, {
      head: [['Fecha', 'Folio', 'Cliente', 'Tipo Servicio', 'Marca Veh.', 'Modelo Veh.', 'Patente Veh.', 'Origen-Destino', 'Estado', 'Valor']],
      body: services.map(s => [
        formatDate(new Date(s.serviceDate + 'T00:00:00'), 'dd/MM/yy'),
        s.folio,
        s.client.name.length > 12 ? s.client.name.substring(0, 12) + '...' : s.client.name,
        s.serviceType.name.length > 10 ? s.serviceType.name.substring(0, 10) + '...' : s.serviceType.name,
        s.vehicleBrand || 'N/A',
        s.vehicleModel || 'N/A',
        s.licensePlate || 'N/A',
        `${s.origin} / ${s.destination}`.length > 20 ? `${s.origin} / ${s.destination}`.substring(0, 20) + '...' : `${s.origin} / ${s.destination}`,
        s.status,
        `$${(s.value || 0).toLocaleString('es-CL')}`
      ]),
      startY: lastY + 10,
      headStyles: { fillColor: [41, 128, 185], fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 1.5 },
      tableWidth: availableWidth,
      columnStyles: {
        0: { cellWidth: availableWidth * 0.08 }, // Fecha - 8%
        1: { cellWidth: availableWidth * 0.08 }, // Folio - 8%
        2: { cellWidth: availableWidth * 0.12 }, // Cliente - 12%
        3: { cellWidth: availableWidth * 0.10 }, // Tipo Servicio - 10%
        4: { cellWidth: availableWidth * 0.08 }, // Marca Veh. - 8%
        5: { cellWidth: availableWidth * 0.08 }, // Modelo Veh. - 8%
        6: { cellWidth: availableWidth * 0.08 }, // Patente Veh. - 8%
        7: { cellWidth: availableWidth * 0.20 }, // Origen-Destino - 20%
        8: { cellWidth: availableWidth * 0.08 }, // Estado - 8%
        9: { cellWidth: availableWidth * 0.10 }  // Valor - 10%
      }
    });
    
    doc.save(`${exportFileDefaultName}.pdf`);

  } else if (format === 'excel') {
    const wb = XLSX.utils.book_new();

    // Hoja principal: Detalle completo de servicios
    const services_data = services.map(s => ({
      'Fecha Servicio': formatDate(new Date(s.serviceDate + 'T00:00:00'), 'yyyy-MM-dd'),
      'Folio': s.folio,
      'Cliente': s.client.name,
      'RUT Cliente': s.client.rut,
      'Tipo de Servicio': s.serviceType.name,
      'Marca Vehículo': s.vehicleBrand || 'N/A',
      'Modelo Vehículo': s.vehicleModel || 'N/A',
      'Patente Vehículo': s.licensePlate || 'N/A',
      'Origen': s.origin,
      'Destino': s.destination,
      'Patente Grúa': s.crane?.licensePlate || 'N/A',
      'Operador': s.operator.name,
      'Estado': s.status,
      'Valor': s.value,
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
      ['Total Servicios', services.length],
      ['Valor Total', totalValue],
    ];
    const summary_ws = XLSX.utils.aoa_to_sheet(summary_ws_data);
    XLSX.utils.book_append_sheet(wb, summary_ws, 'Resumen');

    XLSX.writeFile(wb, `${exportFileDefaultName}.xlsx`);
  }
};
