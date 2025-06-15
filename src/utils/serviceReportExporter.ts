
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Service } from '@/types';
import { Settings } from '@/types/settings';
import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';

interface AppliedFilters {
  dateRange: {
    from: string;
    to: string;
  };
  client: string;
}

interface ExportReportArgs {
  format: 'pdf' | 'excel';
  services: Service[];
  settings: Settings;
  appliedFilters: AppliedFilters;
}

export const exportServiceReport = async ({ format, services, settings, appliedFilters }: ExportReportArgs) => {
  const { company } = settings;
  const exportFileDefaultName = `informe-servicios-${appliedFilters.dateRange.from}-a-${appliedFilters.dateRange.to}`;
  
  const totalValue = services.reduce((acc, service) => acc + service.value, 0);

  if (format === 'pdf') {
    const doc = new jsPDF();
    let startY = 15;

    if (company.logo) {
      try {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = company.logo;
        await new Promise((resolve, reject) => {
          img.onload = () => {
            const pageWidth = doc.internal.pageSize.getWidth();
            const logoWidth = 35;
            const logoHeight = (img.height * logoWidth) / img.width;
            doc.addImage(img, 'PNG', pageWidth - 14 - logoWidth, startY, logoWidth, logoHeight);
            resolve(true);
          };
          img.onerror = (e) => reject(e);
        });
      } catch (e) {
        console.error("Could not add logo to PDF.", e);
      }
    }
    
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(company.name, 14, startY + 7);
    doc.setFont(undefined, 'normal');

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`RUT: ${company.taxId}`, 14, startY + 14);
    doc.text(company.address, 14, startY + 19);
    doc.text(`Tel: ${company.phone} | Email: ${company.email}`, 14, startY + 24);
    
    startY += 30;

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

    autoTable(doc, {
        head: [['Folio', 'Fecha', 'Cliente', 'Origen-Destino', 'Estado', 'Valor']],
        body: services.map(s => [
            s.folio,
            formatDate(new Date(s.serviceDate + 'T00:00:00'), 'dd/MM/yy'),
            s.client.name,
            `${s.origin} / ${s.destination}`,
            s.status,
            `$${s.value.toLocaleString('es-CL')}`
        ]),
        startY: lastY + 10,
        headStyles: { fillColor: [41, 128, 185] }
    });
    
    doc.save(`${exportFileDefaultName}.pdf`);

  } else if (format === 'excel') {
    const wb = XLSX.utils.book_new();

    const summary_ws_data = [
        [company.name],
        ['Informe de Servicios'], [],
        ['Filtros Aplicados'],
        ['Período', `${appliedFilters.dateRange.from} a ${appliedFilters.dateRange.to}`],
        ['Cliente', appliedFilters.client], [],
        ['Resumen'],
        ['Métrica', 'Valor'],
        ['Total Servicios', services.length],
        ['Valor Total', totalValue],
    ];
    const summary_ws = XLSX.utils.aoa_to_sheet(summary_ws_data);
    XLSX.utils.book_append_sheet(wb, summary_ws, 'Resumen');
    
    const services_data = services.map(s => ({
        'Folio': s.folio,
        'Fecha Servicio': formatDate(new Date(s.serviceDate + 'T00:00:00'), 'yyyy-MM-dd'),
        'Cliente': s.client.name,
        'RUT Cliente': s.client.rut,
        'Origen': s.origin,
        'Destino': s.destination,
        'Tipo Servicio': s.serviceType.name,
        'Valor': s.value,
        'Estado': s.status,
        'Patente Grúa': s.crane.licensePlate,
        'Operador': s.operator.name,
        'Observaciones': s.observations,
    }));
    const services_ws = XLSX.utils.json_to_sheet(services_data);
    XLSX.utils.book_append_sheet(wb, services_ws, 'Detalle de Servicios');

    XLSX.writeFile(wb, `${exportFileDefaultName}.xlsx`);
  }
};
