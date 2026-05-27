import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { fetchCompanyData } from './companyDataFetcher';
import { addPDFHeader } from './pdfHeader';
import { formatForDisplay, formatForDisplayWithTime } from '@/utils/timezoneUtils';
import { toTitleCase } from '@/lib/utils';

const VIOLET: [number, number, number] = [139, 92, 246];
const MUTED: [number, number, number] = [100, 100, 100];

const formatCLP = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(Math.round(n || 0));

/**
 * Comprobante de Pago. Hace su propio fetch a Supabase para pago + cliente +
 * facturas cubiertas (vía payment_applications).
 */
export const generatePaymentReceiptPDF = async (paymentId: string): Promise<Blob> => {
  const [companyData, paymentRes] = await Promise.all([
    fetchCompanyData(),
    supabase
      .from('payments')
      .select(
        `
          id, amount, payment_date, payment_method, bank_reference, notes,
          client_id, remaining_amount, created_at,
          clients ( name, rut, address, phone, email ),
          payment_applications (
          applied_amount,
            invoices ( folio, numero_fiscal )
          )
        `,
      )
      .eq('id', paymentId)
      .maybeSingle(),
  ]);

  if (paymentRes.error) throw paymentRes.error;
  const payment: any = paymentRes.data;
  if (!payment) throw new Error('Pago no encontrado');

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.width;
  const marginX = 20;
  const contentWidth = pageWidth - marginX * 2;

  let y = await addPDFHeader(doc, {
    service: { folio: `COMP-${String(payment.id).slice(0, 8).toUpperCase()}` } as any,
    inspection: {},
    companyData,
    title: 'COMPROBANTE DE PAGO',
  } as any);

  const receiptNumber = `COMP-${String(payment.id).slice(0, 8).toUpperCase()}`;
  const today = new Date().toISOString().slice(0, 10);

  // Cabecera del documento
  autoTable(doc, {
    startY: y,
    body: [
      ['N° Comprobante', receiptNumber, 'Fecha emisión', formatForDisplay(today)],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 38, textColor: 60, fillColor: [245, 245, 245] },
      1: { cellWidth: contentWidth / 2 - 38 },
      2: { fontStyle: 'bold', cellWidth: 38, textColor: 60, fillColor: [245, 245, 245] },
      3: { cellWidth: contentWidth / 2 - 38 },
    },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Cliente
  const client = payment.clients || {};
  autoTable(doc, {
    startY: y,
    head: [['Cliente', '']],
    body: [
      ['Razón Social', toTitleCase(client.name || '—')],
      ['RUT', client.rut || '—'],
      ['Dirección', client.address || '—'],
      ['Teléfono', client.phone || '—'],
      ['Email', client.email || '—'],
    ],
    theme: 'grid',
    headStyles: { fillColor: VIOLET, textColor: 255, fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45, textColor: 60 },
      1: { cellWidth: contentWidth - 45 },
    },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Detalles del pago
  const paymentRows: [string, string][] = [
    ['Fecha de pago', payment.payment_date ? formatForDisplay(payment.payment_date) : '—'],
    ['Monto pagado', formatCLP(Number(payment.amount || 0))],
    ['Método de pago', payment.payment_method || '—'],
  ];
  if (payment.bank_reference) paymentRows.push(['Referencia bancaria', payment.bank_reference]);
  if (payment.notes) paymentRows.push(['Notas', payment.notes]);

  autoTable(doc, {
    startY: y,
    head: [['Detalles del Pago', '']],
    body: paymentRows,
    theme: 'grid',
    headStyles: { fillColor: VIOLET, textColor: 255, fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45, textColor: 60 },
      1: { cellWidth: contentWidth - 45 },
    },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Documentos cubiertos
  const apps: any[] = payment.payment_applications || [];
  if (apps.length > 0) {
    const totalApplied = apps.reduce((s, a) => s + Number(a.applied_amount || 0), 0);
    autoTable(doc, {
      startY: y,
      head: [['Folio', 'N° Fiscal', 'Monto aplicado']],
      body: apps.map((a) => [
        a.invoices?.folio || '—',
        a.invoices?.numero_fiscal || '—',
        formatCLP(Number(a.applied_amount || 0)),
      ]),
      foot: [['', 'Total aplicado', formatCLP(totalApplied)]],
      theme: 'grid',
      headStyles: { fillColor: VIOLET, textColor: 255, fontStyle: 'bold', fontSize: 10 },
      footStyles: { fillColor: VIOLET, textColor: 255, fontStyle: 'bold', fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.35 },
        1: { cellWidth: contentWidth * 0.35 },
        2: { cellWidth: contentWidth * 0.3, halign: 'right' },
      },
      margin: { left: marginX, right: marginX },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    const remaining = Number(payment.remaining_amount || 0);
    if (remaining > 0) {
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(`Saldo restante (sin aplicar): ${formatCLP(remaining)}`, pageWidth - marginX, y + 4, {
        align: 'right',
      });
      y += 8;
    }
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('Este pago aún no se ha aplicado a documentos específicos.', marginX, y + 2);
    y += 8;
  }

  // Sello
  y += 4;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'italic');
  const stamp = doc.splitTextToSize(
    'Este comprobante certifica la recepción del pago indicado.',
    contentWidth,
  );
  doc.text(stamp, marginX, y);
  doc.setFont(undefined, 'normal');

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.height;
    doc.setDrawColor(220);
    doc.line(marginX, ph - 14, pageWidth - marginX, ph - 14);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Generado: ${formatForDisplayWithTime(new Date().toISOString())}`, marginX, ph - 9);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - marginX, ph - 9, { align: 'right' });
  }

  return doc.output('blob');
};