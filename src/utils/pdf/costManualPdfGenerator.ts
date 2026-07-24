import { businessClock } from '@/utils/businessClock';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchCompanyData } from './companyDataFetcher';
import {
  DEFAULT_REPORT_LOGO_URL,
  LOCAL_REPORT_LOGO_URL,
  REPORT_PDF_COLORS,
} from './reportPdfTheme';

const VIOLET = REPORT_PDF_COLORS.primary;
const VIOLET_LIGHT = REPORT_PDF_COLORS.total;
const GREEN = REPORT_PDF_COLORS.primary;
const MUTED = REPORT_PDF_COLORS.muted;
const BLACK = REPORT_PDF_COLORS.ink;
const WHITE = REPORT_PDF_COLORS.white;
const GRAY_BG = REPORT_PDF_COLORS.soft;
const WARN: [number, number, number] = [186, 117, 23];
const DANGER: [number, number, number] = [162, 45, 45];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
};

const addHeader = async (doc: jsPDF, companyData: Awaited<ReturnType<typeof fetchCompanyData>>): Promise<number> => {
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, PAGE_W, 26, 'F');

  let logoEndX = MARGIN;
  try {
    const logoBase64 = (companyData.logoUrl ? await loadImageAsBase64(companyData.logoUrl) : null)
      || await loadImageAsBase64(DEFAULT_REPORT_LOGO_URL)
      || await loadImageAsBase64(LOCAL_REPORT_LOGO_URL);
    if (logoBase64) {
      const img = new Image();
      img.src = logoBase64;
      await new Promise(r => { img.onload = r; img.onerror = r; });
      const width = (img as HTMLImageElement).width;
      const height = (img as HTMLImageElement).height;
      const scale = Math.min(31 / width, 17 / height);
      const logoW = width * scale;
      const logoH = height * scale;
      doc.addImage(logoBase64, 'PNG', MARGIN + 1.5, (26 - logoH) / 2, logoW, logoH);
      logoEndX = MARGIN + 1.5 + logoW + 7;
    }
  } catch { /* sin logo */ }

  doc.setTextColor(...WHITE);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(companyData.businessName, logoEndX, 12);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`RUT: ${companyData.rut} · ${companyData.address}`, logoEndX, 20);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('MANUAL INTERNO — CONFIDENCIAL', PAGE_W - MARGIN, 16, { align: 'right' });

  const y = 34;
  doc.setFillColor(...VIOLET_LIGHT);
  doc.rect(MARGIN, y, CONTENT_W, 14, 'F');
  doc.setTextColor(...VIOLET);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Manual de Costos y Centros de Costo', MARGIN + 4, y + 9.5);

  const now = businessClock.format(businessClock.now(), 'dd/MM/yyyy');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(`Versión generada: ${now}`, PAGE_W - MARGIN, y + 9.5, { align: 'right' });

  return y + 20;
};

const addFooter = (doc: jsPDF, pageNum: number, totalPages: number) => {
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text('Grúas 5 Norte · Uso interno · No distribuir', MARGIN, PAGE_H - 8);
  doc.text(`Página ${pageNum} de ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
  doc.setDrawColor(...REPORT_PDF_COLORS.primaryDark);
  doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
};

const sectionTitle = (doc: jsPDF, text: string, y: number): number => {
  doc.setFillColor(...VIOLET);
  doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(text, MARGIN + 3, y + 5.5);
  return y + 12;
};

const subsectionTitle = (doc: jsPDF, text: string, y: number): number => {
  doc.setTextColor(...BLACK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(text, MARGIN, y);
  doc.setDrawColor(...VIOLET);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y + 1.5, MARGIN + 60, y + 1.5);
  doc.setLineWidth(0.2);
  return y + 7;
};

const bodyText = (doc: jsPDF, text: string, y: number, maxWidth = CONTENT_W): number => {
  doc.setTextColor(...BLACK);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, MARGIN, y);
  return y + (lines as string[]).length * 4.5 + 2;
};

const callout = (doc: jsPDF, text: string, y: number, type: 'info' | 'warn' | 'danger' = 'info'): number => {
  const colors: Record<string, { bg: [number,number,number]; border: [number,number,number] }> = {
    info:   { bg: [230, 240, 255], border: VIOLET },
    warn:   { bg: [255, 248, 230], border: WARN },
    danger: { bg: [255, 235, 235], border: DANGER },
  };
  const c = colors[type];
  const lines = doc.splitTextToSize(text, CONTENT_W - 8) as string[];
  const h = lines.length * 4.5 + 6;
  doc.setFillColor(...c.bg);
  doc.rect(MARGIN, y, CONTENT_W, h, 'F');
  doc.setDrawColor(...c.border);
  doc.setLineWidth(0.5);
  doc.rect(MARGIN, y, CONTENT_W, h, 'S');
  doc.setLineWidth(0.2);
  doc.setTextColor(...c.border);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(lines, MARGIN + 4, y + 4.5);
  return y + h + 4;
};

const checkSpace = (doc: jsPDF, y: number, needed: number, pageRef: { num: number }): number => {
  if (y + needed > PAGE_H - 18) {
    doc.addPage();
    pageRef.num += 1;
    return 16;
  }
  return y;
};

export const generateCostManualPDF = async (): Promise<{ blob: Blob; fileName: string }> => {
  const companyData = await fetchCompanyData();
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageRef = { num: 1 };

  let y = await addHeader(doc, companyData);

  // ── 1. Propósito ─────────────────────────────────────────────────────────
  y = sectionTitle(doc, '1. Propósito de este manual', y);
  y = bodyText(doc, 'Este manual define cómo clasificar correctamente los costos en el sistema TMS de Grúas 5 Norte. Su objetivo es garantizar que cada gasto quede registrado en la categoría y centro de costo correcto, permitiendo un control presupuestal confiable y reportes financieros precisos.', y);
  y += 2;
  y = bodyText(doc, 'Aplica a: Administrador del sistema y Secretaria. Ambos tienen acceso para registrar costos.', y);
  y += 4;
  y = callout(doc, 'Regla de oro: si tienes duda entre dos categorías, elige siempre la más específica. Si aún así no está claro, usa "Otros" y deja una nota descriptiva — el administrador revisará y reclasificará mensualmente.', y, 'info');
  y += 4;

  // ── 2. Dos grandes bloques ────────────────────────────────────────────────
  y = checkSpace(doc, y, 20, pageRef);
  y = sectionTitle(doc, '2. Cómo están organizados los costos', y);
  y = bodyText(doc, 'Los costos se dividen en dos grandes grupos según cuándo y cómo se originan:', y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [['Bloque', 'Qué incluye', 'Cómo se registra']],
    body: [
      ['A — Costo variable de servicio', 'Todo lo que se gasta para ejecutar un servicio específico: combustible, peajes, viáticos, subcontratos, trámites para el cliente.', 'Dentro del formulario del servicio, en la sección "Costos del servicio". Se marca como pagado automáticamente.'],
      ['B — Costo fijo de empresa', 'Gastos que existen independiente de los servicios: mantención de flota, seguros, sueldos, arriendo, impuestos.', 'En el módulo de Costos, de forma independiente al servicio.'],
    ],
    headStyles: { fillColor: VIOLET, textColor: WHITE, fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5, textColor: BLACK },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 }, 1: { cellWidth: 85 }, 2: { cellWidth: 52 } },
    alternateRowStyles: { fillColor: GRAY_BG },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── 3. Bloque A — Gastos de Servicios ────────────────────────────────────
  y = checkSpace(doc, y, 20, pageRef);
  y = sectionTitle(doc, '3. Bloque A — Gastos de Servicios (costo variable por servicio)', y);
  y = bodyText(doc, 'Categoría: "Gastos de Servicios". Se accede solo desde el formulario de servicio.', y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['Subcategoría', 'Qué incluir', 'Ejemplo concreto']],
    body: [
      ['Combustible', 'Bencina o diésel cargado para el viaje del servicio.', 'Carga de 30 litros en estación antes de ir al servicio SRV-1045.'],
      ['Peajes', 'Cobro de peajes durante la ruta del servicio.', 'Peaje Ruta 5 Norte, $2.800, servicio SRV-1045.'],
      ['Viáticos', 'Alimentación o gastos del operador durante el servicio.', 'Almuerzo operador en Vallenar durante servicio de larga distancia.'],
      ['Estacionamiento', 'Cobro de estacionamiento durante el servicio.', 'Patio mientras esperaba en taller del cliente.'],
      ['Hospedaje', 'Alojamiento del operador en servicios de más de un día.', 'Hostal operador en ciudad destino, servicio nocturno.'],
      ['Materiales', 'Insumos menores comprados para ejecutar el servicio.', 'Cinta de señalización, conos, guantes desechables.'],
      ['Transporte', 'Traslado adicional del operador o del vehículo.', 'Bus del operador al punto de inicio cuando la grúa ya estaba en destino.'],
      ['Pago Operadores 3ros.', 'Pago a operador externo que ejecutó el servicio.', 'Operador de empresa contratista, $45.000, servicio SRV-1047.'],
      ['Subcontrato / Terceros', 'Servicio completo subcontratado a otra empresa.', 'Grúa de empresa XYZ que realizó el retiro, $120.000.'],
      ['Carga y Descarga', 'Cobro por maniobras de carga o descarga.', 'Pago a bodega por descarga de maquinaria pesada.'],
      ['Trámite Rev. Técnica (cliente)', 'Pago de la revisión técnica del vehículo del CLIENTE. La empresa hace el trámite por encargo.', 'Cliente ABC solicitó realizar la Rev. Técnica de su camión. Se pagó $28.000.'],
      ['Otros', 'Cualquier gasto del servicio que no encaje en las anteriores.', 'Usar solo si no hay categoría adecuada. Dejar nota descriptiva.'],
    ],
    headStyles: { fillColor: VIOLET, textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: BLACK },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 48 }, 1: { cellWidth: 72 }, 2: { cellWidth: 62 } },
    alternateRowStyles: { fillColor: GRAY_BG },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  y = callout(doc, '⚠ "Trámite Rev. Técnica (cliente)" NO es el pago de la revisión técnica de las grúas propias de la empresa. Ese gasto va en Seguros y Permisos > Revisión técnica (flota), en el módulo de Costos.', y, 'warn');
  y += 4;

  // ── 4. Bloque B — Costos fijos ────────────────────────────────────────────
  y = checkSpace(doc, y, 20, pageRef);
  y = sectionTitle(doc, '4. Bloque B — Costos fijos de empresa', y);

  // 4.1 Mantenimiento
  y = checkSpace(doc, y, 15, pageRef);
  y = subsectionTitle(doc, '4.1 Mantenimiento de flota', y);
  y = bodyText(doc, 'Categoría: "Mantenimiento". La mayoría de sus registros se crean automáticamente desde el módulo de Mantención de Grúas y desde Inventario. No registrar manualmente si ya aparece creado automáticamente — revisar primero.', y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['Subcategoría', 'Cuándo usarla', '¿Auto?']],
    body: [
      ['Piezas y Repuestos', 'Compra de repuestos para grúas. Se crea automáticamente al registrar en inventario.', 'Sí'],
      ['Mant. Preventivo', 'Mantención programada (filtros, aceite, correas). Se crea desde el módulo de Mantención.', 'Sí'],
      ['Reparaciones', 'Arreglo de falla o avería. Se crea desde el módulo de Mantención.', 'Sí'],
      ['Consumo de Inventario', 'Uso de materiales de bodega en una grúa. Se crea automáticamente desde Inventario.', 'Sí'],
      ['Servicios externos taller', 'Pago a taller mecánico externo. Registrar manualmente con número de factura.', 'No'],
      ['Lubricantes y Fluidos', 'Aceite, refrigerante, líquido de frenos para la flota. Registro manual.', 'No'],
      ['Inspecciones', 'Diagnóstico técnico, peritaje. Registro manual.', 'No'],
      ['Otros', 'Gasto de mantenimiento no clasificable. Dejar nota.', 'No'],
    ],
    headStyles: { fillColor: GREEN, textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: BLACK },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 52 }, 1: { cellWidth: 112 }, 2: { cellWidth: 18, halign: 'center' } },
    alternateRowStyles: { fillColor: GRAY_BG },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // 4.2 Seguros y Permisos
  y = checkSpace(doc, y, 15, pageRef);
  y = subsectionTitle(doc, '4.2 Seguros y Permisos', y);
  y = bodyText(doc, 'Categoría: "Seguros y Permisos". Gastos anuales de cumplimiento legal de la flota propia.', y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['Subcategoría', 'Descripción']],
    body: [
      ['SOAP', 'Seguro obligatorio de accidentes personales para cada vehículo de la flota.'],
      ['Seguro de carga', 'Póliza que cubre la carga transportada.'],
      ['Seguro de responsabilidad', 'Póliza de responsabilidad civil ante terceros.'],
      ['Permiso de circulación', 'Pago anual del permiso municipal para cada grúa.'],
      ['Revisión técnica (flota)', 'Pago de la Rev. Técnica de las grúas PROPIAS de la empresa. NO confundir con trámite para cliente.'],
      ['Otros', 'Cualquier otro seguro o permiso legal.'],
    ],
    headStyles: { fillColor: [24, 95, 165] as [number,number,number], textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: BLACK },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 52 } },
    alternateRowStyles: { fillColor: GRAY_BG },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // 4.3 Salarios
  y = checkSpace(doc, y, 15, pageRef);
  y = subsectionTitle(doc, '4.3 Salarios', y);

  autoTable(doc, {
    startY: y,
    head: [['Subcategoría', 'Descripción', '¿Auto?']],
    body: [
      ['Comisión Operador', 'Comisión calculada por servicio completado. Se crea automáticamente al cerrar el servicio.', 'Sí'],
      ['Remuneración mensual', 'Sueldo base mensual del personal.', 'No'],
      ['Horas extra', 'Pago de horas adicionales. Registrar con nombre del operador en notas.', 'No'],
      ['Bono producción', 'Bonos por cumplimiento de metas.', 'No'],
      ['Anticipo de sueldo', 'Anticipo entregado antes del cierre de mes.', 'No'],
      ['Liquidación / finiquito', 'Pago de finiquito laboral.', 'No'],
    ],
    headStyles: { fillColor: [83, 74, 183] as [number,number,number], textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: BLACK },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 52 }, 2: { cellWidth: 18, halign: 'center' } },
    alternateRowStyles: { fillColor: GRAY_BG },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // 4.4 Administrativos
  y = checkSpace(doc, y, 15, pageRef);
  y = subsectionTitle(doc, '4.4 Administrativos', y);

  autoTable(doc, {
    startY: y,
    head: [['Subcategoría', 'Ejemplos']],
    body: [
      ['Arriendo oficina / bodega', 'Pago mensual arriendo local o bodega.'],
      ['Software y suscripciones', 'TMS, correo corporativo, antivirus, otras licencias.'],
      ['Servicios básicos', 'Agua, luz, internet, teléfono de la oficina.'],
      ['Útiles y materiales', 'Papelería, tóner, artículos de aseo oficina.'],
      ['Comunicaciones', 'Plan de datos celular, radio comunicaciones.'],
      ['Contabilidad / asesoría', 'Honorarios contador, asesor legal.'],
      ['Otros', 'Gastos administrativos no clasificables.'],
    ],
    headStyles: { fillColor: [95, 94, 90] as [number,number,number], textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: BLACK },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 52 } },
    alternateRowStyles: { fillColor: GRAY_BG },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // 4.5 Impuestos
  y = checkSpace(doc, y, 15, pageRef);
  y = subsectionTitle(doc, '4.5 Impuestos y tributos', y);

  autoTable(doc, {
    startY: y,
    head: [['Subcategoría', 'Descripción']],
    body: [
      ['Patente municipal', 'Pago anual de patente comercial.'],
      ['Multa de tránsito', 'Multas cursadas a vehículos de la flota.'],
      ['IVA no recuperable', 'IVA de compras que no se puede recuperar como crédito fiscal.'],
      ['Impuesto de timbre', 'Impuesto en documentos financieros.'],
      ['Contribuciones', 'Contribuciones de bienes raíces si aplica.'],
      ['Otros tributos', 'Cualquier otro pago tributario.'],
    ],
    headStyles: { fillColor: [153, 53, 86] as [number,number,number], textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: BLACK },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 52 } },
    alternateRowStyles: { fillColor: GRAY_BG },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // ── 5. Centros de Costo ────────────────────────────────────────────────────
  y = checkSpace(doc, y, 20, pageRef);
  y = sectionTitle(doc, '5. Centros de Costo — qué son y cómo asignarlos', y);
  y = bodyText(doc, 'Un centro de costo es la "unidad" a la que se carga el gasto — permite saber cuánto cuesta cada área de la empresa. Al seleccionar una categoría, el sistema pre-asigna el centro automáticamente. El operador puede ajustarlo si corresponde a otro centro.', y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [['Código', 'Centro', 'Qué costos recibe', 'Presupuesto']],
    body: [
      ['OPER', 'Operaciones', 'Todos los Gastos de Servicios (combustible ruta, peajes, viáticos, subcontratos).', 'Mensual'],
      ['MANT', 'Mantenimiento flota', 'Mantenimiento de grúas, piezas, lubricantes, combustible equipos aux.', 'Mensual'],
      ['SEG', 'Seguros y Permisos', 'SOAP, seguro carga, permisos circulación, revisiones técnicas flota.', 'Anual'],
      ['SAL', 'Personal', 'Salarios, comisiones, horas extra, bonos.', 'Mensual'],
      ['ADM', 'Administrativos', 'Arriendo, software, servicios básicos, útiles, asesorías.', 'Mensual'],
      ['IMP', 'Impuestos y tributos', 'Patentes, multas, IVA no recuperable, otros tributos.', 'Sin presupuesto fijo'],
    ],
    headStyles: { fillColor: VIOLET, textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: BLACK },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 18, halign: 'center' },
      1: { fontStyle: 'bold', cellWidth: 36 },
      2: { cellWidth: 104 },
      3: { cellWidth: 24, halign: 'center' },
    },
    alternateRowStyles: { fillColor: GRAY_BG },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  y = callout(doc, 'El centro de costo se asigna automáticamente al elegir la categoría. Solo cambiar si el gasto pertenece a un centro distinto al sugerido. En caso de duda, dejar el que el sistema asignó.', y, 'info');
  y += 4;

  // ── 6. Errores frecuentes ─────────────────────────────────────────────────
  y = checkSpace(doc, y, 20, pageRef);
  y = sectionTitle(doc, '6. Errores frecuentes y cómo evitarlos', y);

  autoTable(doc, {
    startY: y,
    head: [['Error común', 'Lo incorrecto', 'Lo correcto']],
    body: [
      [
        'Confundir Rev. Técnica de flota vs cliente',
        'Registrar en Gastos de Servicios > Trámite Rev. Técnica (cliente) cuando es la revisión de la propia grúa.',
        'Si es la grúa → Seguros y Permisos > Revisión técnica (flota). Si es el vehículo del cliente → Gastos de Servicios > Trámite Rev. Técnica (cliente).',
      ],
      [
        'Registrar combustible de ruta en "Combustible equipos aux."',
        'Usar "Combustible equipos aux." para la bencina cargada antes de un servicio.',
        '"Combustible equipos aux." es solo para generadores y herramientas. El combustible de ruta va en Gastos de Servicios > Combustible.',
      ],
      [
        'Registrar gastos de servicio en módulo Costos',
        'Ir al módulo de Costos para ingresar viáticos o peajes de un servicio.',
        'Los gastos del servicio se registran DENTRO del formulario del servicio, en la sección "Costos del servicio".',
      ],
      [
        'Dejar el centro de costo vacío',
        'Guardar el costo sin asignar centro de costo.',
        'El sistema asigna el centro automáticamente al elegir la categoría. Si no se asigna, el reporte de centros no cuadra.',
      ],
      [
        'Usar "Otros" para todo',
        'Registrar cualquier gasto no reconocido como "Otros" sin descripción.',
        'Revisar la tabla de subcategorías. Si no hay categoría, usar "Otros" pero siempre con nota descriptiva.',
      ],
    ],
    headStyles: { fillColor: DANGER, textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: BLACK },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 48 }, 1: { cellWidth: 64 }, 2: { cellWidth: 70 } },
    alternateRowStyles: { fillColor: [255, 248, 248] as [number,number,number] },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // ── 7. Corrección de errores ──────────────────────────────────────────────
  y = checkSpace(doc, y, 20, pageRef);
  y = sectionTitle(doc, '7. Cómo corregir una clasificación incorrecta', y);
  y = bodyText(doc, 'Si detectas un costo mal clasificado, sigue estos pasos:', y);
  y += 2;

  autoTable(doc, {
    startY: y,
    body: [
      ['1. Identificar el error', 'En el módulo de Costos, buscar el registro. Verificar categoría, subcategoría y centro de costo.'],
      ['2. Editar el costo', 'Hacer clic en el ícono de edición. Cambiar la categoría y/o subcategoría a la correcta.'],
      ['3. Verificar el centro', 'Al cambiar la categoría, el sistema sugerirá el nuevo centro. Confirmar que es el correcto.'],
      ['4. Guardar con nota', 'En el campo Notas, agregar: "Reclasificado [fecha] por [nombre]" para mantener trazabilidad.'],
      ['5. Avisar al administrador', 'Si el costo tiene más de 30 días o está marcado como pagado, avisar — requiere autorización.'],
    ],
    bodyStyles: { fontSize: 8, textColor: BLACK },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 48, textColor: VIOLET } },
    alternateRowStyles: { fillColor: GRAY_BG },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  y = callout(doc, '⛔ Los costos marcados como pagados y los costos con más de 30 días solo puede editarlos el administrador. Si encuentras uno de estos, no intentar editar — informar directamente.', y, 'danger');
  y += 4;

  // ── 8. Revisión mensual ───────────────────────────────────────────────────
  y = checkSpace(doc, y, 20, pageRef);
  y = sectionTitle(doc, '8. Revisión mensual del administrador', y);
  y = bodyText(doc, 'Al cierre de cada mes, el administrador debe realizar las siguientes tareas de control:', y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['Tarea', 'Cómo hacerlo', 'Frecuencia']],
    body: [
      ['Revisar centros excedidos', 'En Centros de Costo, ver los marcados en rojo. Analizar si el exceso fue puntual o recurrente.', 'Mensual'],
      ['Limpiar categoría "Otros"', 'Filtrar costos por subcategoría "Otros". Reclasificar los que ya tienen categoría clara.', 'Mensual'],
      ['Revisar costos sin centro asignado', 'En reportes, filtrar cost_center_id IS NULL. Asignar el centro correcto.', 'Mensual'],
      ['Ajustar presupuestos', 'Si un centro supera consistentemente el presupuesto, ajustarlo o analizar el exceso.', 'Trimestral'],
      ['Revisar categorías inactivas', 'En Configuración > Categorías, verificar si hay categorías desactivadas con costos recientes.', 'Trimestral'],
      ['Auditar nuevas subcategorías', 'Revisar si alguien creó subcategorías nuevas sin autorización. Fusionar duplicados.', 'Trimestral'],
    ],
    headStyles: { fillColor: VIOLET, textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: BLACK },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 52 }, 2: { cellWidth: 24, halign: 'center' } },
    alternateRowStyles: { fillColor: GRAY_BG },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  y = checkSpace(doc, y, 16, pageRef);
  y = callout(doc, `Versión generada el ${businessClock.format(businessClock.now(), 'dd/MM/yyyy')}. Para modificar este manual, actualizar el archivo src/utils/pdf/costManualPdfGenerator.ts y regenerar desde la página de Centros de Costo.`, y, 'info');

  // Footers en todas las páginas
  const totalPages = (doc as any).internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  const fileName = `manual-costos-g5n-${businessClock.today()}.pdf`;
  return { blob: doc.output('blob'), fileName };
};
