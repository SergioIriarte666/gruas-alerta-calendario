import * as XLSX from 'xlsx';
import {
  HEADER_REFERENCIA,
  HEADER_MONTO,
  HEADER_DETALLE,
  HEADER_FECHA,
} from '@/utils/parseClientPaymentExcel';

const TEMPLATE_HEADERS = [HEADER_REFERENCIA, HEADER_MONTO, HEADER_DETALLE, HEADER_FECHA];

const TEMPLATE_EXAMPLE_ROW = ['4128', 150000, 'Pago factura abril', '15.04.2026'];

export function downloadClientPaymentTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE_ROW]);
  sheet['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 14 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Pagos');
  XLSX.writeFile(workbook, 'plantilla-importar-pago-cliente.xlsx');
}
