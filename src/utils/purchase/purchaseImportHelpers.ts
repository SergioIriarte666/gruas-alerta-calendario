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
    return 'border border-success/30 bg-success-soft text-success-text';
  }

  if (status === 'overdue') {
    return 'border border-danger/30 bg-danger-soft text-danger-text';
  }

  return 'border border-border bg-muted text-muted-foreground';
};
