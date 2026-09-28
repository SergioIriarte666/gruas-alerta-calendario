import { businessClock } from '@/utils/businessClock';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import {
  SERVICE_TEMPLATE_HEADERS,
  SERVICE_TEMPLATE_DATA_ROWS,
  buildClientCatalog,
  buildOperatorCatalog,
  catalogCollator,
  computeMaxFolioNumber,
} from './templateCatalogs';

const logger = createLogger('templateGenerator');

export type ExcelTemplateResult = { format: 'xlsx' } | { format: 'csv'; reason: string };

type ExcelJSModule = typeof import('exceljs');

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const FILL_AUTO = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } } as const;
const FILL_LIST = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF6BF' } } as const;
const FILL_HEADER = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } } as const;

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

/** Lee todos los folios SRV- paginando: PostgREST corta en 1.000 filas por consulta. */
const fetchServiceFolios = async (): Promise<string[]> => {
  const PAGE = 1000;
  const folios: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('services')
      .select('folio')
      .like('folio', 'SRV-%')
      .order('folio')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const row of data ?? []) if (row.folio) folios.push(row.folio);
    if (!data || data.length < PAGE) break;
  }
  return folios;
};

/**
 * Número desde el que la plantilla correlativiza. Es el mayor entre el máximo real de
 * services y el último que entregó la secuencia (company_data.next_service_folio_number
 * lo espeja next_service_folio()): un folio quemado por borrado no se reutiliza.
 */
const fetchFolioStartNumber = async (): Promise<number> => {
  const [folios, companyRes] = await Promise.all([
    fetchServiceFolios(),
    supabase.from('company_data').select('next_service_folio_number').limit(1).maybeSingle(),
  ]);
  if (companyRes.error) logger.warn('No se pudo leer next_service_folio_number:', companyRes.error);
  const sequenceLast = (companyRes.data?.next_service_folio_number ?? 1) - 1;
  return Math.max(computeMaxFolioNumber(folios), sequenceLast, 0);
};

const loadCatalogs = async () => {
  const [clientsRes, typesRes, cranesRes, operatorsRes, folioStart] = await Promise.all([
    supabase.from('clients').select('name, rut, department').eq('is_active', true).order('name'),
    supabase.from('service_types').select('name').eq('is_active', true).order('name'),
    supabase.from('cranes').select('license_plate, brand, model').eq('is_active', true).order('license_plate'),
    supabase.from('operators').select('name, rut').eq('is_active', true).order('name'),
    fetchFolioStartNumber(),
  ]);
  for (const res of [clientsRes, typesRes, cranesRes, operatorsRes]) {
    if (res.error) throw res.error;
  }

  return {
    clients: buildClientCatalog(clientsRes.data ?? []),
    serviceTypes: Array.from(new Set((typesRes.data ?? []).map(t => (t.name ?? '').trim()).filter(Boolean)))
      .sort(catalogCollator.compare),
    cranes: (cranesRes.data ?? [])
      .map(c => ({
        plate: (c.license_plate ?? '').trim(),
        equipment: [c.brand, c.model].map(v => (v ?? '').trim()).filter(Boolean).join(' '),
      }))
      .filter(c => c.plate !== '')
      .sort((a, b) => catalogCollator.compare(a.plate, b.plate)),
    operators: buildOperatorCatalog(operatorsRes.data ?? []),
    folioStart,
  };
};

type Catalogs = Awaited<ReturnType<typeof loadCatalogs>>;

const buildWorkbook = (ExcelJS: ExcelJSModule, catalogs: Catalogs) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Grúas 5 Norte TMS';
  wb.calcProperties.fullCalcOnLoad = true;

  // "Servicios" DEBE ser la primera hoja: el importador lee SheetNames[0].
  const ws = wb.addWorksheet('Servicios', { views: [{ state: 'frozen', ySplit: 1 }] });
  const cat = wb.addWorksheet('Catalogos');
  const ins = wb.addWorksheet('Instrucciones');

  // ---------- Catalogos ----------
  cat.getRow(1).values = ['Etiqueta', 'Nombre', 'RUT', 'Departamento', '', 'Tipo Servicio', '', 'Patente', 'Equipo', '', 'Nombre', 'RUT'];
  cat.getRow(1).font = { bold: true };
  catalogs.clients.forEach((c, i) => {
    cat.getRow(i + 2).getCell(1).value = c.label;
    cat.getRow(i + 2).getCell(2).value = c.name;
    cat.getRow(i + 2).getCell(3).value = c.rut;
    cat.getRow(i + 2).getCell(4).value = c.department;
  });
  catalogs.serviceTypes.forEach((t, i) => { cat.getRow(i + 2).getCell(6).value = t; });
  catalogs.cranes.forEach((g, i) => {
    cat.getRow(i + 2).getCell(8).value = g.plate;
    cat.getRow(i + 2).getCell(9).value = g.equipment;
  });
  catalogs.operators.forEach((o, i) => {
    cat.getRow(i + 2).getCell(11).value = o.label;
    cat.getRow(i + 2).getCell(12).value = o.rut;
  });
  [40, 32, 14, 18, 3, 24, 3, 12, 24, 3, 30, 14].forEach((w, i) => { cat.getColumn(i + 1).width = w; });

  // Un rango vacío rompe el nombre definido: como mínimo apunta a la fila 2.
  const lastRow = (n: number) => Math.max(2, n + 1);
  wb.definedNames.add(`Catalogos!$A$2:$D$${lastRow(catalogs.clients.length)}`, 'ClientesTabla');
  wb.definedNames.add(`Catalogos!$A$2:$A$${lastRow(catalogs.clients.length)}`, 'ClientesLista');
  wb.definedNames.add(`Catalogos!$F$2:$F$${lastRow(catalogs.serviceTypes.length)}`, 'TiposLista');
  wb.definedNames.add(`Catalogos!$H$2:$H$${lastRow(catalogs.cranes.length)}`, 'GruasLista');
  wb.definedNames.add(`Catalogos!$K$2:$L$${lastRow(catalogs.operators.length)}`, 'OperadoresTabla');
  wb.definedNames.add(`Catalogos!$K$2:$K$${lastRow(catalogs.operators.length)}`, 'OperadoresLista');

  // ---------- Servicios ----------
  const header = ws.getRow(1);
  header.values = [...SERVICE_TEMPLATE_HEADERS];
  header.font = { bold: true };
  header.fill = FILL_HEADER;
  header.alignment = { vertical: 'middle', wrapText: true };
  header.height = 30;
  [12, 14, 14, 14, 36, 18, 15, 15, 11, 22, 22, 22, 12, 13, 14, 14, 30, 12, 12, 12, 28]
    .forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  ws.getColumn('B').numFmt = 'dd/mm/yyyy';
  ws.getColumn('C').numFmt = 'dd/mm/yyyy';
  for (const col of ['M', 'P', 'R', 'S', 'T']) ws.getColumn(col).numFmt = '#,##0';

  const first = 2;
  const last = first + SERVICE_TEMPLATE_DATA_ROWS - 1;
  const { folioStart } = catalogs;
  for (let r = first; r <= last; r++) {
    const row = ws.getRow(r);
    row.getCell('A').value = { formula: `IF($E${r}="","","SRV-"&(${folioStart}+COUNTA($E$2:$E${r})))` };
    row.getCell('D').value = { formula: `IF($E${r}="","",IFERROR(VLOOKUP($E${r},ClientesTabla,3,0),""))` };
    row.getCell('F').value = { formula: `IF($E${r}="","",IFERROR(VLOOKUP($E${r},ClientesTabla,4,0),""))` };
    row.getCell('O').value = { formula: `IF($U${r}="","",IFERROR(VLOOKUP($U${r},OperadoresTabla,2,0),""))` };
    for (const col of ['A', 'D', 'F', 'O']) row.getCell(col).fill = FILL_AUTO;
    for (const col of ['E', 'L', 'N', 'U']) row.getCell(col).fill = FILL_LIST;
  }

  const listValidation = (name: string, prompt: string) => ({
    type: 'list' as const,
    allowBlank: true,
    formulae: [name],
    showErrorMessage: true,
    errorStyle: 'stop' as const,
    errorTitle: 'Valor fuera del catálogo',
    error: `Elija ${prompt} de la lista desplegable.`,
  });
  ws.dataValidations.add(`E${first}:E${last}`, listValidation('ClientesLista', 'un cliente'));
  ws.dataValidations.add(`L${first}:L${last}`, listValidation('TiposLista', 'un tipo de servicio'));
  ws.dataValidations.add(`N${first}:N${last}`, listValidation('GruasLista', 'una grúa'));
  ws.dataValidations.add(`U${first}:U${last}`, listValidation('OperadoresLista', 'un operador'));

  // ---------- Instrucciones ----------
  const lines = [
    'Plantilla de carga masiva de Servicios',
    '',
    `1. Folio: se calcula solo (parte en SRV-${folioStart + 1}) apenas se elige un cliente. No lo escriba a mano.`,
    '2. Celdas grises (Folio, Cliente RUT, Cliente Departamento, Operador RUT) son automáticas: no las toque.',
    '3. Celdas amarillas (Cliente Nombre, Tipo Servicio, Grúa Patente, Operador Nombre) se eligen de la lista desplegable.',
    '4. Fechas en formato dd/mm/aaaa. Valores en pesos, sin puntos ni signo $.',
    '5. Combustible, Viaticos y Peajes son opcionales: si llevan monto se registran como costos del servicio.',
    '6. Guarde el archivo en Excel (Ctrl+S) antes de subirlo, para que las fórmulas queden calculadas.',
    `7. Los catálogos son los registros activos a la fecha (${businessClock.today()}). Si falta un cliente, grúa u operador, créelo en el sistema y descargue la plantilla de nuevo.`,
    '8. No cambie el nombre ni el orden de las columnas de la hoja "Servicios": el importador las reconoce por nombre.',
  ];
  lines.forEach((text, i) => {
    const cell = ins.getRow(i + 1).getCell(1);
    cell.value = text;
    if (i === 0) cell.font = { bold: true, size: 14 };
  });
  ins.getColumn(1).width = 120;

  return wb;
};

export class TemplateGenerator {
  static downloadTemplate(): void {
    const csvContent = SERVICE_TEMPLATE_HEADERS.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    downloadBlob(blob, `plantilla_servicios_${businessClock.today()}.csv`);
  }

  /**
   * Plantilla Excel con catálogos reales (clientes, tipos, grúas, operadores), listas
   * desplegables, fórmulas de autocompletado y folio correlativo. Se genera con exceljs
   * (import dinámico: SheetJS Community no escribe validaciones ni nombres definidos).
   * Si algo falla se entrega la plantilla CSV y se informa el motivo al llamador.
   */
  static async downloadExcelTemplate(): Promise<ExcelTemplateResult> {
    try {
      logger.debug('📊 Generando plantilla Excel con catálogos...');
      const [excelModule, catalogs] = await Promise.all([import('exceljs'), loadCatalogs()]);
      const ExcelJS = ((excelModule as unknown as { default?: ExcelJSModule }).default ?? excelModule) as ExcelJSModule;

      const wb = buildWorkbook(ExcelJS, catalogs);
      const buffer = await wb.xlsx.writeBuffer();
      downloadBlob(new Blob([buffer], { type: XLSX_MIME }), `plantilla_servicios_${businessClock.today()}.xlsx`);

      logger.debug('✅ Plantilla Excel descargada', {
        clientes: catalogs.clients.length,
        tipos: catalogs.serviceTypes.length,
        gruas: catalogs.cranes.length,
        operadores: catalogs.operators.length,
        folioStart: catalogs.folioStart,
      });
      return { format: 'xlsx' };
    } catch (error) {
      logger.error('❌ Error generando plantilla Excel:', error);
      logger.warn('Descargando plantilla CSV como alternativa.');
      this.downloadTemplate();
      return { format: 'csv', reason: error instanceof Error ? error.message : 'Error desconocido' };
    }
  }
}
