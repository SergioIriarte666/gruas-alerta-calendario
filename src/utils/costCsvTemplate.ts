import { businessClock } from '@/utils/businessClock';
import * as XLSX from 'xlsx';

const TEMPLATE_COLUMNS = [
  'Fecha',
  'Descripción',
  'Monto',
  'Categoría',
  'Subcategoría',
  'Notas',
  'Pagado',
  'Fecha Pago',
];

const EXAMPLE_ROWS = [
  ['2026-03-20', 'Combustible grúa ABCD-12', '150000', 'Gastos Operacionales', 'Combustible', 'Factura #4521', 'Sí', '2026-03-20'],
  ['2026-03-19', 'Peaje Ruta 5', '8500', 'Gastos Operacionales', 'Peajes', '', 'No', ''],
  ['2026-03-18', 'Mantención preventiva', '320000', 'Mantenimiento', '', 'Orden de trabajo #89', 'Sí', '2026-03-18'],
];

const triggerDownload = (blob: Blob, fileName: string) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Descarga no disponible en este entorno');
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    if (link.parentNode) link.parentNode.removeChild(link);
    URL.revokeObjectURL(url);
  }, 250);
};

export const generateCostCsvTemplate = () => {
  const csvContent = [
    TEMPLATE_COLUMNS.join(','),
    ...EXAMPLE_ROWS.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, 'plantilla_costos.csv');
};

export const generateCostExcelTemplate = () => {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS, ...EXAMPLE_ROWS]);

  ws['!cols'] = [
    { wch: 12 }, // Fecha
    { wch: 35 }, // Descripción
    { wch: 12 }, // Monto
    { wch: 25 }, // Categoría
    { wch: 20 }, // Subcategoría
    { wch: 25 }, // Notas
    { wch: 8 },  // Pagado
    { wch: 12 }, // Fecha Pago
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Costos');
  const timestamp = businessClock.today();
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, `plantilla_costos_${timestamp}.xlsx`);
};
