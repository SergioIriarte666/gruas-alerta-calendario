export interface CompanyReference {
  rut: string;
  name: string;
}

interface CompanyCandidate {
  rut?: string | null;
  name?: string | null;
}

const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ');

export const normalizeCompanyRut = (rut?: string | null): string =>
  (rut || '').replace(/[.\s-]/g, '').toUpperCase();

export const normalizeCompanyName = (name?: string | null): string =>
  normalizeWhitespace(name || '').toUpperCase();

export const resolveCanonicalCompany = (
  company: CompanyCandidate,
  references: CompanyReference[] = [],
): CompanyReference | null => {
  const rawRut = normalizeWhitespace(company.rut || '');
  const rawName = normalizeWhitespace(company.name || '');
  const normalizedRut = normalizeCompanyRut(rawRut);
  const normalizedName = normalizeCompanyName(rawName);

  if (!normalizedRut && !normalizedName) {
    return null;
  }

  const byRut = normalizedRut
    ? references.find(reference => normalizeCompanyRut(reference.rut) === normalizedRut)
    : undefined;

  if (byRut) {
    return byRut;
  }

  const byName = normalizedName
    ? references.find(reference => normalizeCompanyName(reference.name) === normalizedName)
    : undefined;

  if (byName) {
    return byName;
  }

  return {
    rut: rawRut,
    name: rawName || rawRut,
  };
};
