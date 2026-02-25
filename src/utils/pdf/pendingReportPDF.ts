
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfToday, addDays } from 'date-fns';
import { fetchCompanyData } from '@/utils/pdf/companyDataFetcher';

interface DailyServiceSummary {
  scheduled: number;
  completed: number;
  inProgress: number;
  cancelled: number;
  todayServices: Array<{ folio: string; client: string; status: string; type: string }>;
}

const fetchTodayServices = async (): Promise<DailyServiceSummary> => {
  const today = format(startOfToday(), 'yyyy-MM-dd');
  
  const { data } = await supabase
    .from('services')
    .select('folio, status, service_type, client:clients!services_client_id_fkey(name)')
    .eq('service_date', today);

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
    todayServices: services.map((s: any) => ({
      folio: s.folio,
      client: (s.client as any)?.name ?? 'N/A',
      status: statusMap[s.status] || s.status,
      type: s.service_type || '-',
    })),
  };
};

export const generatePendingReportPDF = async (): Promise<jsPDF> => {
  const today = startOfToday();
  const todayStr = format(today, 'yyyy-MM-dd');
  const closureThreshold = addDays(today, -30);
  const closureStr = format(closureThreshold, 'yyyy-MM-dd');

  const { data: companySettings } = await supabase.from('company_data').select('alert_days').maybeSingle();
  const alertDays = companySettings?.alert_days ?? 30;
  const alertDateLimit = addDays(today, alertDays);
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
    todayServicesSummary,
  ] = await Promise.all([
    supabase.from('services')
      .select('id, folio, service_date, client:clients!services_client_id_fkey(name)')
      .eq('status', 'completed')
      .or('purchase_order.is.null,purchase_order.eq.')
      .or('purchase_order_number.is.null,purchase_order_number.eq.')
      .order('service_date', { ascending: true }).limit(500),
    supabase.from('services')
      .select('id, folio, service_date, client:clients!services_client_id_fkey(name)')
      .eq('status', 'completed')
      .or('quote_number.is.null,quote_number.eq.')
      .order('service_date', { ascending: true }).limit(500),
    supabase.from('services')
      .select('id, folio, service_date, service_value, client:clients!services_client_id_fkey(name, billing_type)')
      .eq('status', 'completed')
      .order('service_date', { ascending: true }).limit(1000),
    supabase.from('closure_services').select('service_id'),
    supabase.from('services')
      .select('id, folio, service_date, client:clients!services_client_id_fkey(name)')
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
    fetchTodayServices(),
  ]);

  const daysSince = (dateStr: string) =>
    Math.floor((today.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));

  const invoicedSet = new Set((invoicedServiceIdsRes.data || []).map((r: any) => r.service_id));

  // Process data
  const pendingInvoicing = (allCompletedRes.data || [])
    .filter((s: any) => !invoicedSet.has(s.id))
    .filter((s: any) => (s.client as any)?.billing_type !== 'monthly')
    .map((s: any) => [
      s.folio, (s.client as any)?.name ?? 'N/A',
      new Date(s.service_date).toLocaleDateString('es-CL'),
      daysSince(s.service_date).toString(),
      s.service_value ? `$${Number(s.service_value).toLocaleString('es-CL')}` : '-',
    ]);

  const withoutOC = (servicesWithoutOCRes.data || []).map((s: any) => [
    s.folio, (s.client as any)?.name ?? 'N/A',
    new Date(s.service_date).toLocaleDateString('es-CL'),
    daysSince(s.service_date).toString(),
  ]);

  const withoutQuote = (servicesWithoutQuoteRes.data || []).map((s: any) => [
    s.folio, (s.client as any)?.name ?? 'N/A',
    new Date(s.service_date).toLocaleDateString('es-CL'),
    daysSince(s.service_date).toString(),
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
      s.folio, (s.client as any)?.name ?? 'N/A',
      new Date(s.service_date).toLocaleDateString('es-CL'),
      daysSince(s.service_date).toString(),
    ]);

  const expiringDocs: string[][] = [];
  (expiringCranesRes.data || []).forEach((crane: any) => {
    [
      { type: 'Permiso Circulación', date: crane.circulation_permit_expiry },
      { type: 'Seguro', date: crane.insurance_expiry },
      { type: 'Revisión Técnica', date: crane.technical_review_expiry },
    ].forEach(c => {
      if (c.date) {
        const d = Math.ceil((new Date(c.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (d <= alertDays) {
          expiringDocs.push([
            crane.license_plate, c.type,
            new Date(c.date).toLocaleDateString('es-CL'),
            d <= 0 ? `¡Vencido hace ${Math.abs(d)} días!` : `${d} días`,
          ]);
        }
      }
    });
  });
  (expiringOperatorsRes.data || []).forEach((op: any) => {
    if (op.exam_expiry) {
      const d = Math.ceil((new Date(op.exam_expiry).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (d <= alertDays) {
        expiringDocs.push([
          op.name, 'Examen Médico',
          new Date(op.exam_expiry).toLocaleDateString('es-CL'),
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
  doc.text(`Fecha: ${today.toLocaleDateString('es-CL')}`, pageWidth / 2, y, { align: 'center' });
  y += 3;
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.8);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  const addSection = (title: string, count: number, headers: string[], data: string[][], colStyles?: any) => {
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

    autoTable(doc, {
      startY: y,
      head: [headers],
      body: data,
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [51, 51, 51] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
      columnStyles: colStyles || {},
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
    autoTable(doc, {
      startY: y,
      head: [['Folio', 'Cliente', 'Tipo', 'Estado']],
      body: ts.todayServices.map(s => [s.folio, s.client, s.type, s.status]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [51, 51, 51] },
      alternateRowStyles: { fillColor: [239, 246, 255] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    y += 2;
    doc.setTextColor(100, 100, 100);
    doc.text('Sin servicios programados para hoy', 18, y);
    y += 10;
  }

  // Pending sections
  addSection('1. Servicios Pendientes de Facturar', pendingInvoicing.length,
    ['Folio', 'Cliente', 'Fecha', 'Días', 'Valor'], pendingInvoicing, { 0: { cellWidth: 25 }, 4: { halign: 'right' } });
  addSection('2. Servicios sin Orden de Compra', withoutOC.length,
    ['Folio', 'Cliente', 'Fecha', 'Días'], withoutOC, { 0: { cellWidth: 25 } });
  addSection('3. Servicios sin Cotización', withoutQuote.length,
    ['Folio', 'Cliente', 'Fecha', 'Días'], withoutQuote, { 0: { cellWidth: 25 } });
  addSection('4. Facturas Pendientes de Pago', overdueInvoices.length,
    ['Folio', 'Cliente', 'Atraso', 'Monto'], overdueInvoices, { 3: { halign: 'right' } });
  addSection('5. Servicios Pendientes de Cierre', pendingClosures.length,
    ['Folio', 'Cliente', 'Fecha', 'Días'], pendingClosures, { 0: { cellWidth: 25 } });
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
  const todayStr = format(startOfToday(), 'yyyy-MM-dd');
  doc.save(`Reporte_Pendientes_${todayStr}.pdf`);
};
