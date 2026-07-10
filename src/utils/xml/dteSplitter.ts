export interface SplitDteDocument {
  fileName: string;
  content: string;
  folio: string;
  tipoDte: string;
  issueDate: string;
}

export interface SplitDteResult {
  documents: SplitDteDocument[];
  errors: string[];
}

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

const getDirectChildText = (element: Element, selector: string): string =>
  element.querySelector(selector)?.textContent?.trim() || '';

const sanitizeFilePart = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const getRootWrapperName = (root: Element | null): string => {
  if (!root) return 'SetDTE';
  if (root.localName === 'DTE') return 'SetDTE';
  return root.tagName || 'SetDTE';
};

const buildWrapperOpenTag = (root: Element | null): string => {
  const wrapperName = getRootWrapperName(root);
  if (!root || root.localName === 'DTE') return `<${wrapperName}>`;

  const attrs = Array.from(root.attributes)
    .map(attr => `${attr.name}="${attr.value.replace(/"/g, '&quot;')}"`)
    .join(' ');

  return attrs ? `<${wrapperName} ${attrs}>` : `<${wrapperName}>`;
};

export const splitDteXmlString = (xmlString: string): SplitDteResult => {
  if (!xmlString.trim()) {
    return { documents: [], errors: ['El archivo XML está vacío'] };
  }

  const parser = new DOMParser();
  const parsed = parser.parseFromString(xmlString, 'text/xml');

  if (parsed.querySelector('parsererror')) {
    return { documents: [], errors: ['El archivo XML no es válido'] };
  }

  const dteElements = Array.from(parsed.getElementsByTagName('DTE'));
  const root = parsed.documentElement;
  const documents = dteElements.length > 0
    ? dteElements
    : root?.localName === 'DTE'
      ? [root]
      : [];

  if (documents.length === 0) {
    return { documents: [], errors: ['No se encontraron facturas DTE en el XML'] };
  }

  const serializer = new XMLSerializer();
  const wrapperOpenTag = buildWrapperOpenTag(root);
  const wrapperName = getRootWrapperName(root);

  return {
    errors: [],
    documents: documents.map((dte, index) => {
      const folio = getDirectChildText(dte, 'Documento > Encabezado > IdDoc > Folio') || `${index + 1}`;
      const tipoDte = getDirectChildText(dte, 'Documento > Encabezado > IdDoc > TipoDTE') || 'DTE';
      const issueDate = getDirectChildText(dte, 'Documento > Encabezado > IdDoc > FchEmis') || 'sin-fecha';
      const safeTipo = sanitizeFilePart(tipoDte) || 'DTE';
      const safeFolio = sanitizeFilePart(folio) || `${index + 1}`;
      const safeDate = sanitizeFilePart(issueDate) || 'sin-fecha';
      const serializedDte = serializer.serializeToString(dte);

      return {
        folio,
        tipoDte,
        issueDate,
        fileName: `Factura_T${safeTipo}_F${safeFolio}_${safeDate}.xml`,
        content: `${XML_DECLARATION}\n${wrapperOpenTag}\n${serializedDte}\n</${wrapperName}>\n`,
      };
    }),
  };
};

export const splitDteXmlFile = async (file: File): Promise<SplitDteResult> => {
  const xmlString = await file.text();
  return splitDteXmlString(xmlString);
};
