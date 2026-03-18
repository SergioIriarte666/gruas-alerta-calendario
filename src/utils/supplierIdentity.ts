import { Supplier } from '@/types/suppliers';

type SupplierIdentityLike = Pick<Supplier, 'name' | 'rut'> & {
  created_at?: string | null;
  updated_at?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  contact_name?: string | null;
  contact_person?: string | null;
  notes?: string | null;
  category?: string | null;
};

export const normalizeSupplierRut = (rut?: string | null): string => {
  return (rut || '').replace(/[^0-9kK]/g, '').toUpperCase().trim();
};

export const normalizeSupplierName = (name?: string | null): string => {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
};

export const getSupplierIdentityKey = (supplier: Pick<SupplierIdentityLike, 'name' | 'rut'>): string => {
  const normalizedRut = normalizeSupplierRut(supplier.rut);
  if (normalizedRut) return `rut:${normalizedRut}`;

  const normalizedName = normalizeSupplierName(supplier.name);
  if (normalizedName) return `name:${normalizedName}`;

  return '';
};

export const findSupplierByIdentity = <T extends Pick<SupplierIdentityLike, 'name' | 'rut'>>(
  suppliers: T[],
  target: Pick<SupplierIdentityLike, 'name' | 'rut'>
): T | undefined => {
  const targetRut = normalizeSupplierRut(target.rut);
  const targetName = normalizeSupplierName(target.name);

  if (targetRut) {
    const byRut = suppliers.find((supplier) => normalizeSupplierRut(supplier.rut) === targetRut);
    if (byRut) return byRut;
  }

  if (targetName) {
    return suppliers.find((supplier) => normalizeSupplierName(supplier.name) === targetName);
  }

  return undefined;
};

export const dedupeSuppliersByIdentity = <T extends Pick<SupplierIdentityLike, 'name' | 'rut'>>(
  suppliers: T[],
  pickPreferred?: (current: T, incoming: T) => T
): T[] => {
  const unique = new Map<string, T>();

  suppliers.forEach((supplier, index) => {
    const key = getSupplierIdentityKey(supplier) || `fallback:${index}`;
    const current = unique.get(key);

    if (!current) {
      unique.set(key, supplier);
      return;
    }

    unique.set(key, pickPreferred ? pickPreferred(current, supplier) : current);
  });

  return Array.from(unique.values());
};
