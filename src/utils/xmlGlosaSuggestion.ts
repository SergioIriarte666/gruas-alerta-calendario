import { XMLDocumentData } from '@/types/suppliers';

type GlosaDocumentLike = Pick<XMLDocumentData, 'folio' | 'document_type'>;

const DOCUMENT_NUMBER_PATTERNS = [
  /((?:Factura|Boleta|Documento|Folio|Nota de [A-Za-zÁÉÍÓÚáéíóúÑñ ]+)[^\d\n]{0,20})(\d[\d.-]*)/i,
  /((?:N[°ºo.]|No\.?|Nro\.?|Numero\.?)\s*)(\d[\d.-]*)/i,
];

const buildFallbackGlosa = (doc: GlosaDocumentLike) => {
  const typeLabel = (doc.document_type || 'Factura').trim() || 'Factura';
  const folio = (doc.folio || '').trim();

  if (!folio) return typeLabel;
  return `${typeLabel} ${folio}`.trim();
};

export const applyCurrentDocumentFolioToSuggestion = (
  suggestedDescription: string,
  doc: GlosaDocumentLike
) => {
  const folio = (doc.folio || '').trim();
  const trimmedSuggestion = suggestedDescription.trim();

  if (!trimmedSuggestion) return buildFallbackGlosa(doc);
  if (!folio) return trimmedSuggestion;

  if (trimmedSuggestion.includes(folio)) {
    return trimmedSuggestion;
  }

  for (const pattern of DOCUMENT_NUMBER_PATTERNS) {
    if (!pattern.test(trimmedSuggestion)) continue;

    return trimmedSuggestion.replace(pattern, (_, prefix: string) => `${prefix}${folio}`);
  }

  return `${trimmedSuggestion} - Folio ${folio}`.trim();
};
