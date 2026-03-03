
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays } from 'date-fns';
import { fetchCompanyData } from '@/utils/pdf/companyDataFetcher';
import { 
  getBusinessTimezone, 
  getTodayStringInTimezone, 
  safeParseDateOnly, 
  safeDaysSince, 
  safeDateToDisplay, 
  isSameYearMonth 
} from '@/utils/timezoneUtils';

interface DailyServiceSummary {
  scheduled: number;
  completed: number;
  inProgress: number;
  cancelled: number;
  todayServices: Array<{ folio: string; client: string; status: string }>;
}

const fetchTodayServices = async (todayStr: string): Promise<DailyServiceSummary> => {
  const { data } = await supabase
    .from('services')
    .select('folio, status, client:clients!services_client_id_fkey(name, department)')
    .eq('service_date', todayStr);

  const services = data || [];
  const statusMap: Record<string, string> = {
    scheduled: 'Programado',
    pending: 'Pendiente',
    in_progress: 'En Curso',
    completed: 'Completado',
    cancelled: 'Cancelado',
  };

  return {
    scheduled: services.filter((s: any) => s.status === 'scheduled' || s.status === 'pending').length,
    completed: services.filter((s: any) => s.status === 'completed').length,
    inProgress: services.filter((s: any) => s.status === 'in_progress').length,
    cancelled: services.filter((s: any) => s.status === 'cancelled').length,
    todayServices: services.map((s: any) => {
      const clientObj = s.client as any;
      const clientLabel = clientObj ? (clientObj.department && clientObj.department !== 'General' ? `${clientObj.name} - ${clientObj.department}` : clientObj.name) : 'N/A';
      return {
        folio: s.folio,
        client: clientLabel,
        status: statusMap[s.status] || s.status,
      };
    }),
  };
};

export const generatePendingReportPDF = async (): Promise<jsPDF> => {
  // Get business timezone from company_data (single source of truth)
  const businessTz = await getBusinessTimezone();
  const todayStr = getTodayStringInTimezone(businessTz);
  const todaySafe = safeParseDateOnly(todayStr);
  const closureThreshold = addDays(todaySafe, -30);
  const closureStr = format(closureThreshold, 'yyyy-MM-dd');

  const { data: companySettings } = await supabase.from('company_data').select('alert_days').maybeSingle();
  const alertDays = companySettings?.alert_days ?? 30;
  const alertDateLimit = addDays(todaySafe, alertDays);
  const alertDateStr = format(alertDateLimit, 'yyyy-MM-dd');

  const companyData = await fetchCompanyData();

  // Fetch all data in parallel
  const [
    servicesWithoutOCRes,
    servicesWithoutQuoteRes,
    allCompletedRes,
    closedServiceIdsRes,
    completedOldRes,
    overdueRes,
    expiringCranesRes,
    expiringOperatorsRes,
    invoicedServiceIdsRes,
    monthlyClientsRes,
    todayServicesSummary,
  ] = await Promise.all([
    supabase.from('services')
      .select('id, folio, service_date, client:clients!services_client_id_fkey(name, department, billing_type)')
      .eq('status', 'completed')
      .or('purchase_order.is.null,purchase_order.eq.')
      .or('purchase_order_number.is.null,purchase_order_number.eq.')
      .order('service_date', { ascending: true }).limit(500),
    supabase.from('services')
      .select('id, folio, service_date, client:clients!services_client_id_fkey(name, department, billing_type)')
      .eq('status', 'completed')
      .or('quote_number.is.null,quote_number.eq.')
      .order('service_date', { ascending: true }).limit(500),
    supabase.from('services')
      .select('id, folio, service_date, value, client:clients!services_client_id_fkey(name, department, billing_type)')
      .eq('status', 'completed')
      .order('service_date', { ascending: true }).limit(1000),
    supabase.from('closure_services').select('service_id'),
    supabase.from('services')
      .select('id, folio, service_date, client:clients!services_client_id_fkey(name, department)')
      .eq('status', 'completed')
      .lte('service_date', closureStr)
      .order('service_date', { ascending: true }),
    supabase.rpc('get_overdue_invoices_for_alerts'),
    supabase.from('cranes')
      .select('id, license_plate, circulation_permit_expiry, insurance_expiry, technical_review_expiry')
      .eq('is_active', true)
      .or(`circulation_permit_expiry.lte.${alertDateStr},insurance_expiry.lte.${alertDateStr},technical_review_expiry.lte.${alertDateStr}`),
    supabase.from('operators')
      .select('id, name, exam_expiry')
      .eq('is_active', true)
      .lte('exam_expiry', alertDateStr),
    supabase.from('invoice_services').select('service_id'),
    supabase.from('clients')
      .select('name, department')
      .eq('billing_type', 'monthly')
      .order('name', { ascending: true }),
    fetchTodayServices(todayStr),
  ]);

  const clientLabel = (c: any) => {
    if (!c) return 'N/A';
    return c.department && c.department !== 'General' ? `${c.name} - ${c.department}` : c.name;
  };

  const invoicedSet = new Set((invoicedServiceIdsRes.data || []).map((r: any) => r.service_id));

  // Helper: hide monthly-billing services only if they belong to the current month (safe date-only comparison)
  const isCurrentMonthMonthly = (s: any) => {
    const bt = (s.client as any)?.billing_type;
    if (bt !== 'monthly') return false;
    return isSameYearMonth(s.service_date, todayStr);
  };

  // Build monthly client summary
  const monthlyCurrentMonthServices = (allCompletedRes.data || []).filter((s: any) => isCurrentMonthMonthly(s));
  const monthlyByClient: Record<string, number> = {};
  monthlyCurrentMonthServices.forEach((s: any) => {
    const name = clientLabel(s.client);
    monthlyByClient[name] = (monthlyByClient[name] || 0) + 1;
  });

  const monthlyClientNames = new Set<string>([
    ...(monthlyClientsRes.data || []).map((c: any) => clientLabel(c)),
    ...Object.keys(monthlyByClient),
  ]);

  const monthlyClientRows = Array.from(monthlyClientNames)
    .sort((a, b) => {
      const countDiff = (monthlyByClient[b] || 0) - (monthlyByClient[a] || 0);
      return countDiff !== 0 ? countDiff : a.localeCompare(b, 'es');
    })
    .map((name) => [name, `${monthlyByClient[name] || 0} servicio(s)`]);

  // Process data using safe date helpers
  const allPendingInvoicing = (allCompletedRes.data || []).filter((s: any) => !invoicedSet.has(s.id));
  const pendingInvoicing = allPendingInvoicing
    .filter((s: any) => !isCurrentMonthMonthly(s))
    .map((s: any) => [
      s.folio, clientLabel(s.client),
      safeDateToDisplay(s.service_date),
      safeDaysSince(s.service_date, todayStr).toString(),
      s.value ? `$${Number(s.value).toLocaleString('es-CL')}` : '-',
    ]);

  const withoutOC = (servicesWithoutOCRes.data || [])
    .filter((s: any) => !isCurrentMonthMonthly(s))
    .map((s: any) => [
      s.folio, clientLabel(s.client),
      safeDateToDisplay(s.service_date),
      safeDaysSince(s.service_date, todayStr).toString(),
    ]);

  const withoutQuote = (servicesWithoutQuoteRes.data || [])
    .filter((s: any) => !isCurrentMonthMonthly(s))
    .map((s: any) => [
      s.folio, clientLabel(s.client),
      safeDateToDisplay(s.service_date),
      safeDaysSince(s.service_date, todayStr).toString(),
    ]);

  const overdueInvoices = (!overdueRes.error && overdueRes.data || []).map((inv: any) => [
    inv.folio, inv.client_name,
    `${inv.days_overdue} días`,
    `$${Number(inv.total).toLocaleString('es-CL')}`,
  ]);

  const closedIds = new Set((closedServiceIdsRes.data || []).map((i: any) => i.service_id));
  const pendingClosures = (completedOldRes.data || [])
    .filter((s: any) => !closedIds.has(s.id))
    .map((s: any) => [
      s.folio, clientLabel(s.client),
      safeDateToDisplay(s.service_date),
      safeDaysSince(s.service_date, todayStr).toString(),
    ]);

  const expiringDocs: string[][] = [];
  (expiringCranesRes.data || []).forEach((crane: any) => {
    [
      { type: 'Permiso Circulación', date: crane.circulation_permit_expiry },
      { type: 'Seguro', date: crane.insurance_expiry },
      { type: 'Revisión Técnica', date: crane.technical_review_expiry },
    ].forEach(c => {
      if (c.date) {
        const d = safeDaysSince(todayStr, c.date); // days until expiry (positive = future)
        if (d <= alertDays) {
          expiringDocs.push([
            crane.license_plate, c.type,
            safeDateToDisplay(c.date),
            d <= 0 ? `¡Vencido hace ${Math.abs(d)} días!` : `${d} días`,
          ]);
        }
      }
    });
  });
  (expiringOperatorsRes.data || []).forEach((op: any) => {
    if (op.exam_expiry) {
      const d = safeDaysSince(todayStr, op.exam_expiry);
      if (d <= alertDays) {
        expiringDocs.push([
          op.name, 'Examen Médico',
          safeDateToDisplay(op.exam_expiry),
          d <= 0 ? `¡Vencido hace ${Math.abs(d)} días!` : `${d} días`,
        ]);
      }
    }
  });

  // ──── GENERATE PDF ────
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text(companyData.businessName, pageWidth / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(14);
  doc.setTextColor(51, 51, 51);
  doc.text('Reporte Diario de Pendientes', pageWidth / 2, y, { align: 'center' });
  y += 7;
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Fecha: ${safeDateToDisplay(todayStr)} | TZ: ${businessTz}`, pageWidth / 2, y, { align: 'center' });
  y += 3;
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.8);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  // Helper: group rows by client column (index 1) with sub-headers
  const groupAndInsertClientHeaders = (data: string[][], clientColIndex: number): { rows: string[][]; clientRowIndices: Set<number> } => {
    if (data.length === 0) return { rows: [], clientRowIndices: new Set() };
    
    // Group by client
    const groups: Record<string, string[][]> = {};
    data.forEach(row => {
      const client = row[clientColIndex] || 'N/A';
      if (!groups[client]) groups[client] = [];
      groups[client].push(row);
    });

    // Sort groups alphabetically
    const sortedClients = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'es'));

    const result: string[][] = [];
    const clientRowIndices = new Set<number>();

    sortedClients.forEach(client => {
      const clientRows = groups[client];
      // Insert sub-header row (fill all columns with empty except first which has client name)
      const headerRow = Array(clientRows[0].length).fill('');
      headerRow[0] = `▶ ${client} (${clientRows.length})`;
      clientRowIndices.add(result.length);
      result.push(headerRow);
      // Add client rows (sorted by date column - index 2 typically)
      result.push(...clientRows);
    });

    return { rows: result, clientRowIndices };
  };

  const addSection = (title: string, count: number, headers: string[], data: string[][], colStyles?: any, groupByClient?: boolean) => {
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 15;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 51, 51);
    doc.text(`${title} (${count})`, 14, y);
    y += 2;

    if (data.length === 0) {
      y += 4;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('✅ Sin pendientes en esta categoría', 18, y);
      y += 10;
      return;
    }

    let bodyData = data;
    let clientRowIndices = new Set<number>();

    if (groupByClient) {
      const grouped = groupAndInsertClientHeaders(data, 1);
      bodyData = grouped.rows;
      clientRowIndices = grouped.clientRowIndices;
    }

    autoTable(doc, {
      startY: y,
      head: [headers],
      body: bodyData,
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [51, 51, 51] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
      columnStyles: colStyles || {},
      didParseCell: (hookData: any) => {
        if (hookData.section === 'body' && clientRowIndices.has(hookData.row.index)) {
          hookData.cell.styles.fillColor = [55, 65, 81];
          hookData.cell.styles.textColor = [255, 255, 255];
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fontSize = 8;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  };

  // Section 0: Today's Services Summary
  if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 15; }
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 51, 51);
  doc.text('Servicios del Día', 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const ts = todayServicesSummary;
  const summaryLine = `Programados: ${ts.scheduled}  |  En Curso: ${ts.inProgress}  |  Completados: ${ts.completed}  |  Cancelados: ${ts.cancelled}`;
  doc.text(summaryLine, 14, y);
  y += 4;

  if (ts.todayServices.length > 0) {
    const todayData = ts.todayServices.map(s => [s.folio, s.client, s.status]);
    const todayGrouped = groupAndInsertClientHeaders(todayData, 1);

    autoTable(doc, {
      startY: y,
      head: [['Folio', 'Cliente', 'Estado']],
      body: todayGrouped.rows,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [51, 51, 51] },
      alternateRowStyles: { fillColor: [239, 246, 255] },
      margin: { left: 14, right: 14 },
      didParseCell: (hookData: any) => {
        if (hookData.section === 'body' && todayGrouped.clientRowIndices.has(hookData.row.index)) {
          hookData.cell.styles.fillColor = [55, 65, 81];
          hookData.cell.styles.textColor = [255, 255, 255];
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fontSize = 8;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    y += 2;
    doc.setTextColor(100, 100, 100);
    doc.text('Sin servicios programados para hoy', 18, y);
    y += 10;
  }

  // Monthly clients section
  if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 15; }
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 51, 51);
  doc.text(`Clientes Facturación Mensual - Mes en Curso (${monthlyCurrentMonthServices.length} servicios)`, 14, y);
  y += 2;

  if (monthlyClientRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Cliente', 'Servicios del Mes']],
      body: monthlyClientRows,
      theme: 'striped',
      headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [51, 51, 51] },
      alternateRowStyles: { fillColor: [238, 242, 255] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    y += 4;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Sin servicios de facturación mensual en el mes en curso', 18, y);
    y += 10;
  }

  // Pending sections
  addSection('1. Servicios Pendientes de Facturar', pendingInvoicing.length,
    ['Folio', 'Cliente', 'Fecha', 'Días', 'Valor'], pendingInvoicing, { 0: { cellWidth: 25 }, 4: { halign: 'right' } }, true);
  addSection('2. Servicios sin Orden de Compra', withoutOC.length,
    ['Folio', 'Cliente', 'Fecha', 'Días'], withoutOC, { 0: { cellWidth: 25 } }, true);
  addSection('3. Servicios sin Cotización', withoutQuote.length,
    ['Folio', 'Cliente', 'Fecha', 'Días'], withoutQuote, { 0: { cellWidth: 25 } }, true);
  addSection('4. Facturas Pendientes de Pago', overdueInvoices.length,
    ['Folio', 'Cliente', 'Atraso', 'Monto'], overdueInvoices, { 3: { halign: 'right' } }, true);
  addSection('5. Servicios Pendientes de Cierre', pendingClosures.length,
    ['Folio', 'Cliente', 'Fecha', 'Días'], pendingClosures, { 0: { cellWidth: 25 } }, true);
  addSection('6. Documentación por Vencer', expiringDocs.length,
    ['Entidad', 'Documento', 'Vencimiento', 'Plazo'], expiringDocs);

  // Summary box
  if (y > doc.internal.pageSize.getHeight() - 55) { doc.addPage(); y = 15; }
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, y, pageWidth - 28, 45, 3, 3, 'S');
  y += 8;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text('Resumen', pageWidth / 2, y, { align: 'center' });
  y += 7;
  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  doc.setFont('helvetica', 'normal');
  const items = [
    `Servicios Hoy: ${ts.todayServices.length}`,
    `Pend. Facturar: ${pendingInvoicing.length}`,
    `Sin OC: ${withoutOC.length}`,
    `Sin Cotización: ${withoutQuote.length}`,
    `Fact. Vencidas: ${overdueInvoices.length}`,
    `Pend. Cierre: ${pendingClosures.length}`,
    `Doc. por Vencer: ${expiringDocs.length}`,
  ];
  const col1 = items.slice(0, 4);
  const col2 = items.slice(4);
  col1.forEach((item, i) => doc.text(`• ${item}`, 22, y + i * 6));
  col2.forEach((item, i) => doc.text(`• ${item}`, pageWidth / 2 + 5, y + i * 6));

  // Footer on all pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `${companyData.businessName} | ${companyData.phone} | ${companyData.email}`,
      pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' }
    );
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' }
    );
  }

  return doc;
};

export const downloadPendingReportPDF = async () => {
  const doc = await generatePendingReportPDF();
  const businessTz = await getBusinessTimezone();
  const todayStr = getTodayStringInTimezone(businessTz);
  doc.save(`Reporte_Pendientes_${todayStr}.pdf`);
};
