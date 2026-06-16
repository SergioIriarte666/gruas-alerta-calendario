/**
 * Utilidades de importación de compras históricas.
 * Extraídas de PurchaseHistoryImport para testing y reutilización independientes.
 */

export const formatCLP = (amount: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);

export const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

export const normalizeRut = (rut: string): string =>
  rut.replace(/[^0-9Kk]/g, '').trim().toUpperCase();

export const rutCandidates = (rut: string): string[] => {
  const n = normalizeRut(rut);
  if (!n) return [''];
  if (n.length === 1) return [n];
  const base = n.slice(0, -1);
  return n === base ? [n] : [n, base];
};

export const rutMatches = (a: string, b: string): boolean => {
  const aC = rutCandidates(a);
  const bC = new Set(rutCandidates(b));
  return aC.some((c) => bC.has(c));
};

export const getInvoiceStatusBadgeClass = (status: 'paid' | 'pending' | 'overdue') => {
  if (status === 'paid') {
    return 'border border-green-200 bg-green-50 text-green-700';
  }

  if (status === 'overdue') {
    return 'border border-red-200 bg-red-50 text-red-700';
  }

  return 'border border-slate-200 bg-slate-100 text-slate-700';
};
