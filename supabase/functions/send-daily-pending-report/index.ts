
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";
import jsPDFModule from "npm:jspdf@2.5.2";
import "npm:jspdf-autotable@5.0.2";

// Handle both ESM default export and CJS module.exports
const jsPDF = (jsPDFModule as any).jsPDF || (jsPDFModule as any).default?.jsPDF || jsPDFModule;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ──── SAFE DATE-ONLY HELPERS (same logic as frontend timezoneUtils) ────

/** Parse YYYY-MM-DD safely without timezone shift */
const safeParseDateOnly = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date(dateStr);
  const [, y, m, d] = match;
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0);
};

/** Format YYYY-MM-DD to dd-MM-yyyy (pure string, no Date) */
const safeDateToDisplay = (dateStr: string): string => {
  if (!dateStr) return "N/A";
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return dateStr;
  return `${match[3]}-${match[2]}-${match[1]}`;
};

/** Days between two YYYY-MM-DD strings */
const safeDaysSince = (dateStr: string, todayStr: string): number => {
  const d = safeParseDateOnly(dateStr);
  const t = safeParseDateOnly(todayStr);
  return Math.floor((t.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
};

/** Check if two YYYY-MM-DD strings share same year-month */
const isSameYearMonth = (dateStr: string, refStr: string): boolean => {
  return dateStr.substring(0, 7) === refStr.substring(0, 7);
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Authentication: require CRON_SECRET or valid JWT ──
    const cronSecret = Deno.env.get("CRON_SECRET");
    const requestSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization");

    let authenticated = false;

    // Option 1: Cron secret header
    if (cronSecret && requestSecret && cronSecret === requestSecret) {
      authenticated = true;
    }

    // Option 2: Valid JWT (for manual triggers from the app)
    if (!authenticated && authHeader?.startsWith("Bearer ")) {
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
      if (!claimsError && claimsData?.claims) {
        authenticated = true;
      }
    }

    if (!authenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("🚀 Iniciando generación de reporte diario de pendientes...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if daily report is enabled + get business timezone from company_data (single source of truth)
    const { data: companyData, error: companyError } = await supabase
      .from("company_data")
      .select("*")
      .single();

    if (companyError || !companyData) {
      console.error("Error fetching company data:", companyError);
      return new Response(JSON.stringify({ error: "No company data found" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!companyData.daily_report_enabled) {
      console.log("📭 Reporte diario desactivado. Saliendo.");
      return new Response(JSON.stringify({ message: "Daily report disabled" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const emails = (companyData.daily_report_emails || companyData.email || "")
      .split(",")
      .map((e: string) => e.trim())
      .filter((e: string) => e.length > 0);

    if (emails.length === 0) {
      console.log("📭 No hay destinatarios configurados.");
      return new Response(JSON.stringify({ message: "No recipients" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Business timezone from company_data (single source of truth)
    const userTimezone = companyData.report_timezone || "America/Santiago";
    console.log(`🕐 Usando zona horaria de negocio: ${userTimezone}`);

    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: userTimezone });
    const todaySafe = safeParseDateOnly(todayStr);
    const closureThresholdDate = new Date(todaySafe);
    closureThresholdDate.setDate(closureThresholdDate.getDate() - 30);
    const closureStr = closureThresholdDate.toISOString().split("T")[0];
    const alertDays = companyData.alert_days ?? 30;
    const alertDate = new Date(todaySafe);
    alertDate.setDate(alertDate.getDate() + alertDays);
    const alertDateStr = alertDate.toISOString().split("T")[0];

    // ──── QUERIES ────
    const [
      servicesWithoutOCRes,
      servicesWithoutQuoteRes,
      pendingInvoiceServicesRes,
      closedServiceIdsRes,
      completedOldRes,
      overdueRes,
      expiringCranesRes,
      expiringOperatorsRes,
      monthlyClientsRes,
      todayServicesRes,
    ] = await Promise.all([
      supabase
        .from("services")
        .select("id, folio, service_date, client:clients!services_client_id_fkey(name, department, billing_type)")
        .eq("status", "completed")
        .or("purchase_order.is.null,purchase_order.eq.")
        .or("purchase_order_number.is.null,purchase_order_number.eq.")
        .order("service_date", { ascending: true })
        .limit(500),
      supabase
        .from("services")
        .select("id, folio, service_date, client:clients!services_client_id_fkey(name, department, billing_type)")
        .eq("status", "completed")
        .or("quote_number.is.null,quote_number.eq.")
        .order("service_date", { ascending: true })
        .limit(500),
      supabase
        .from("services")
        .select("id, folio, service_date, value, client:clients!services_client_id_fkey(name, department, billing_type)")
        .eq("status", "completed")
        .order("service_date", { ascending: true })
        .limit(1000),
      supabase.from("closure_services").select("service_id"),
      supabase
        .from("services")
        .select("id, folio, service_date, client:clients!services_client_id_fkey(name, department)")
        .eq("status", "completed")
        .lte("service_date", closureStr)
        .order("service_date", { ascending: true }),
      supabase.rpc("get_overdue_invoices_for_alerts"),
      supabase
        .from("cranes")
        .select("id, license_plate, circulation_permit_expiry, insurance_expiry, technical_review_expiry")
        .eq("is_active", true)
        .or(`circulation_permit_expiry.lte.${alertDateStr},insurance_expiry.lte.${alertDateStr},technical_review_expiry.lte.${alertDateStr}`),
      supabase
        .from("operators")
        .select("id, name, exam_expiry")
        .eq("is_active", true)
        .lte("exam_expiry", alertDateStr),
      supabase
        .from("clients")
        .select("name, department")
        .eq("billing_type", "monthly")
        .order("name", { ascending: true }),
      supabase
        .from("services")
        .select("folio, status, client:clients!services_client_id_fkey(name, department)")
        .eq("service_date", todayStr),
    ]);

    // Check which services already have invoices
    const { data: invoicedServiceIds } = await supabase
      .from("invoice_services")
      .select("service_id");
    const invoicedSet = new Set((invoicedServiceIds || []).map((r: any) => r.service_id));

    // ──── PROCESS DATA ────
    const clientLabel = (c: any) => {
      if (!c) return "N/A";
      return c.department && c.department !== "General" ? `${c.name} - ${c.department}` : c.name;
    };

    // Helper: hide monthly-billing services only if they belong to the current month (safe date-only)
    const isCurrentMonthMonthly = (service: any) => {
      if (service.client?.billing_type !== "monthly") return false;
      return isSameYearMonth(service.service_date, todayStr);
    };

    // Build monthly client summary
    const monthlyCurrentMonthServices = (pendingInvoiceServicesRes.data || []).filter((s: any) => isCurrentMonthMonthly(s));
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
        return countDiff !== 0 ? countDiff : a.localeCompare(b, "es");
      })
      .map((name) => [name, `${monthlyByClient[name] || 0} servicio(s)`]);

    // 1. Pending invoicing (with safe date helpers)
    const pendingInvoicing = (pendingInvoiceServicesRes.data || [])
      .filter((s: any) => !invoicedSet.has(s.id))
      .filter((s: any) => !isCurrentMonthMonthly(s))
      .map((s: any) => [
        s.folio,
        clientLabel(s.client),
        safeDateToDisplay(s.service_date),
        safeDaysSince(s.service_date, todayStr).toString(),
        s.value ? `$${Number(s.value).toLocaleString("es-CL")}` : "-",
      ]);

    // 2. Without OC
    const withoutOC = (servicesWithoutOCRes.data || [])
      .filter((s: any) => !isCurrentMonthMonthly(s))
      .map((s: any) => [
        s.folio,
        clientLabel(s.client),
        safeDateToDisplay(s.service_date),
        safeDaysSince(s.service_date, todayStr).toString(),
      ]);

    // 3. Without quote
    const withoutQuote = (servicesWithoutQuoteRes.data || [])
      .filter((s: any) => !isCurrentMonthMonthly(s))
      .map((s: any) => [
        s.folio,
        clientLabel(s.client),
        safeDateToDisplay(s.service_date),
        safeDaysSince(s.service_date, todayStr).toString(),
      ]);

    // 4. Overdue invoices
    const overdueInvoices = (!overdueRes.error && overdueRes.data || []).map((inv: any) => [
      inv.folio,
      inv.client_name,
      `${inv.days_overdue} días`,
      `$${Number(inv.total).toLocaleString("es-CL")}`,
    ]);

    // 5. Pending closures
    const closedIds = new Set((closedServiceIdsRes.data || []).map((i: any) => i.service_id));
    const pendingClosures = (completedOldRes.data || [])
      .filter((s: any) => !closedIds.has(s.id))
      .map((s: any) => [
        s.folio,
        clientLabel(s.client),
        safeDateToDisplay(s.service_date),
        safeDaysSince(s.service_date, todayStr).toString(),
      ]);

    // 6. Expiring documents (safe date helpers)
    const expiringDocs: string[][] = [];
    (expiringCranesRes.data || []).forEach((crane: any) => {
      const checks = [
        { type: "Permiso Circulación", date: crane.circulation_permit_expiry },
        { type: "Seguro", date: crane.insurance_expiry },
        { type: "Revisión Técnica", date: crane.technical_review_expiry },
      ];
      checks.forEach((c) => {
        if (c.date) {
          const d = safeDaysSince(todayStr, c.date); // days until expiry
          if (d <= alertDays) {
            expiringDocs.push([
              crane.license_plate,
              c.type,
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
            op.name,
            "Examen Médico",
            safeDateToDisplay(op.exam_expiry),
            d <= 0 ? `¡Vencido hace ${Math.abs(d)} días!` : `${d} días`,
          ]);
        }
      }
    });

    // Process today's services
    const todayServices = (todayServicesRes.data || []);
    const statusMap: Record<string, string> = {
      scheduled: "Programado", pending: "Pendiente", in_progress: "En Curso",
      completed: "Completado", cancelled: "Cancelado",
    };
    const todayScheduled = todayServices.filter((s: any) => s.status === "scheduled" || s.status === "pending").length;
    const todayInProgress = todayServices.filter((s: any) => s.status === "in_progress").length;
    const todayCompleted = todayServices.filter((s: any) => s.status === "completed").length;
    const todayCancelled = todayServices.filter((s: any) => s.status === "cancelled").length;
    const todayServiceRows = todayServices.map((s: any) => [
      s.folio, clientLabel(s.client), statusMap[s.status] || s.status,
    ]);

    // ──── GENERATE PDF ────
    console.log("📄 Generando PDF...");
    const doc = new jsPDF();
    const companyName = companyData.business_name || "Grúas 5 Norte";
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(34, 197, 94);
    doc.text(companyName, pageWidth / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(14);
    doc.setTextColor(51, 51, 51);
    doc.text("Reporte Diario de Pendientes", pageWidth / 2, y, { align: "center" });
    y += 7;
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(`Fecha: ${safeDateToDisplay(todayStr)} | TZ: ${userTimezone}`, pageWidth / 2, y, { align: "center" });
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
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 51, 51);
      doc.text(`${title} (${count})`, 14, y);
      y += 2;

      if (data.length === 0) {
        y += 4;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text("✅ Sin pendientes en esta categoría", 18, y);
        y += 10;
        return;
      }

      (doc as any).autoTable({
        startY: y,
        head: [headers],
        body: data,
        theme: "striped",
        headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [51, 51, 51] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 14, right: 14 },
        columnStyles: colStyles || {},
        didDrawPage: () => {},
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    };

    // Section 0: Today's Services
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 51, 51);
    doc.text("Servicios del Día", 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Programados: ${todayScheduled}  |  En Curso: ${todayInProgress}  |  Completados: ${todayCompleted}  |  Cancelados: ${todayCancelled}`, 14, y);
    y += 4;
    if (todayServiceRows.length > 0) {
      (doc as any).autoTable({
        startY: y,
        head: [["Folio", "Cliente", "Estado"]],
        body: todayServiceRows,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [51, 51, 51] },
        alternateRowStyles: { fillColor: [239, 246, 255] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    } else {
      y += 2;
      doc.setTextColor(100, 100, 100);
      doc.text("Sin servicios programados para hoy", 18, y);
      y += 10;
    }

    // Monthly clients section
    if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 51, 51);
    doc.text(`Clientes Facturación Mensual - Mes en Curso (${monthlyCurrentMonthServices.length} servicios)`, 14, y);
    y += 2;

    if (monthlyClientRows.length > 0) {
      (doc as any).autoTable({
        startY: y,
        head: [["Cliente", "Servicios del Mes"]],
        body: monthlyClientRows,
        theme: "striped",
        headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [51, 51, 51] },
        alternateRowStyles: { fillColor: [238, 242, 255] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    } else {
      y += 4;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text("Sin servicios de facturación mensual en el mes en curso", 18, y);
      y += 10;
    }

    // Pending Sections
    addSection("1. Servicios Pendientes de Facturar", pendingInvoicing.length,
      ["Folio", "Cliente", "Fecha", "Días", "Valor"], pendingInvoicing,
      { 0: { cellWidth: 25 }, 4: { halign: "right" } });
    addSection("2. Servicios sin Orden de Compra", withoutOC.length,
      ["Folio", "Cliente", "Fecha", "Días"], withoutOC, { 0: { cellWidth: 25 } });
    addSection("3. Servicios sin Cotización", withoutQuote.length,
      ["Folio", "Cliente", "Fecha", "Días"], withoutQuote, { 0: { cellWidth: 25 } });
    addSection("4. Facturas Pendientes de Pago", overdueInvoices.length,
      ["Folio", "Cliente", "Atraso", "Monto"], overdueInvoices, { 3: { halign: "right" } });
    addSection("5. Servicios Pendientes de Cierre", pendingClosures.length,
      ["Folio", "Cliente", "Fecha", "Días"], pendingClosures, { 0: { cellWidth: 25 } });
    addSection("6. Documentación por Vencer", expiringDocs.length,
      ["Entidad", "Documento", "Vencimiento", "Plazo"], expiringDocs);

    // Summary box
    if (y > doc.internal.pageSize.getHeight() - 50) {
      doc.addPage();
      y = 15;
    }
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(0.5);
    doc.roundedRect(14, y, pageWidth - 28, 40, 3, 3, "S");
    y += 8;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(34, 197, 94);
    doc.text("Resumen", pageWidth / 2, y, { align: "center" });
    y += 7;
    doc.setFontSize(9);
    doc.setTextColor(51, 51, 51);
    doc.setFont("helvetica", "normal");
    const summaryItems = [
      `Servicios Hoy: ${todayServiceRows.length}`,
      `Pend. Facturar: ${pendingInvoicing.length}`,
      `Sin OC: ${withoutOC.length}`,
      `Sin Cotización: ${withoutQuote.length}`,
      `Fact. Vencidas: ${overdueInvoices.length}`,
      `Pend. Cierre: ${pendingClosures.length}`,
      `Doc. por Vencer: ${expiringDocs.length}`,
    ];
    const col1 = summaryItems.slice(0, 4);
    const col2 = summaryItems.slice(4);
    col1.forEach((item, i) => {
      doc.text(`• ${item}`, 22, y + i * 6);
    });
    col2.forEach((item, i) => {
      doc.text(`• ${item}`, pageWidth / 2 + 5, y + i * 6);
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `${companyName} | ${companyData.phone} | ${companyData.email}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: "center" }
      );
      doc.text(
        `Página ${i} de ${pageCount}`,
        pageWidth - 14,
        doc.internal.pageSize.getHeight() - 8,
        { align: "right" }
      );
    }

    // Convert to base64
    const pdfOutput = doc.output("arraybuffer");
    const pdfBase64 = btoa(
      new Uint8Array(pdfOutput).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    // ──── SEND EMAIL ────
    console.log(`📧 Enviando reporte a: ${emails.join(", ")}`);
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    const totalPendientes =
      pendingInvoicing.length +
      withoutOC.length +
      withoutQuote.length +
      overdueInvoices.length +
      pendingClosures.length +
      expiringDocs.length;

    const emailResponse = await resend.emails.send({
      from: `${companyName} <facturacion@gruas5norte.com>`,
      to: emails,
      subject: `📋 Reporte Diario de Pendientes - ${safeDateToDisplay(todayStr)} (${totalPendientes} pendientes)`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #22c55e; text-align: center;">${companyName}</h2>
          <h3 style="text-align: center; color: #333;">Reporte Diario de Pendientes</h3>
          <p style="text-align: center; color: #666;">${safeDateToDisplay(todayStr)} | TZ: ${userTimezone}</p>
          
          <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <h4 style="margin-top: 0; color: #1e40af;">🗓️ Servicios del Día:</h4>
            <p style="margin: 5px 0;">Programados: <strong>${todayScheduled}</strong> | En Curso: <strong>${todayInProgress}</strong> | Completados: <strong>${todayCompleted}</strong> | Cancelados: <strong>${todayCancelled}</strong></p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin-top: 0;">Pendientes:</h4>
            <ul style="list-style: none; padding: 0;">
              <li>📄 Pendientes de Facturar: <strong>${pendingInvoicing.length}</strong></li>
              <li>📋 Sin Orden de Compra: <strong>${withoutOC.length}</strong></li>
              <li>💬 Sin Cotización: <strong>${withoutQuote.length}</strong></li>
              <li>💰 Facturas Vencidas: <strong>${overdueInvoices.length}</strong></li>
              <li>🔒 Pendientes de Cierre: <strong>${pendingClosures.length}</strong></li>
              <li>⚠️ Documentos por Vencer: <strong>${expiringDocs.length}</strong></li>
            </ul>
            <p style="font-size: 18px; text-align: center; margin: 15px 0 0;">
              <strong>Total: ${totalPendientes} pendientes</strong>
            </p>
          </div>
          
          <p style="text-align: center; color: #666;">
            Adjunto encontrarás el reporte completo en PDF con el detalle de cada categoría.
          </p>
          
          <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
            <p>${companyName} | ${companyData.phone} | ${companyData.email}</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `Reporte_Pendientes_${todayStr}.pdf`,
          content: pdfBase64,
          content_type: "application/pdf",
        },
      ],
    });

    console.log("✅ Reporte enviado:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        recipients: emails,
        totalPendientes,
        emailResponse,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("❌ Error en reporte diario:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
