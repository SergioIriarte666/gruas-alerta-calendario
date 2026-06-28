import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireUserRoles, withHeaders } from '../_shared/auth.ts';

const CATEGORY_MAP: Array<{ patterns: string[]; tmsCategory: string }> = [
  {
    patterns: ['moto', 'motoneta', 'cuatrimoto'],
    tmsCategory: 'MOTO',
  },
  {
    patterns: [
      'autos y camionetas',
      'auto y camioneta',
      'camioneta con',
      'camioneta sin',
      'autos,',
      'camionetas con o sin',
      'station wagon',
      'furgon',
    ],
    tmsCategory: 'LIVIANO',
  },
  {
    patterns: [
      'camiones de dos ejes',
      'camion de dos ejes',
      'camion 2 ejes',
      'camiones de 2 ejes',
      'doble rueda trasera',
      'maquinaria agricola',
      'maquinaria de construccion',
      'buses de dos ejes',
    ],
    tmsCategory: 'CAMION_2_EJES',
  },
  {
    patterns: [
      'camiones de mas de dos ejes',
      'camion de mas de dos ejes',
      'camiones de más de dos ejes',
      'mas de dos ejes',
      'buses de mas de dos ejes',
      'buses de más de dos ejes',
    ],
    tmsCategory: 'CAMION_PESADO',
  },
];

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseCLP = (value: string): number => {
  const cleaned = value.replace(/\$/g, '').replace(/\./g, '').replace(/,/g, '').trim();
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const detectCategory = (text: string): string | null => {
  const normalizedText = normalize(text);
  for (const entry of CATEGORY_MAP) {
    if (entry.patterns.some((pattern) => normalizedText.includes(normalize(pattern)))) {
      return entry.tmsCategory;
    }
  }
  return null;
};

interface ParsedRate {
  stationName: string;
  vehicleCategory: string;
  rateAmount: number;
  rawCategoryText: string;
}

interface ParseResult {
  concessionName: string | null;
  rates: ParsedRate[];
  rawText: string;
  warnings: string[];
}

const parseMopText = (text: string): ParseResult => {
  const warnings: string[] = [];
  const rates: ParsedRate[] = [];

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let concessionName: string | null = null;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line === line.toUpperCase() && line.length > 5 && !/^\$/.test(line)) {
      concessionName = line;
      break;
    }
  }

  const priceLineRegex = /\$[\d.,]+/g;
  let stationNames: string[] = [];
  let currentCategoryText = '';
  let foundFirstPrice = false;

  for (const line of lines) {
    const prices = line.match(priceLineRegex);

    if (!foundFirstPrice && !prices) {
      if (
        line === line.toUpperCase() &&
        line.length > 3 &&
        !line.includes('PEAJE') &&
        !line.includes('TARIFA')
      ) {
        const parts = line
          .split(/\s{2,}|\t/)
          .map((part) => part.trim())
          .filter(Boolean);

        if (parts.length > 0) {
          stationNames = [...stationNames, ...parts];
        }
      }
      continue;
    }

    if (prices) {
      foundFirstPrice = true;
      const amounts = prices.map((price) => parseCLP(price)).filter((amount) => amount > 0);

      if (amounts.length > 0 && currentCategoryText) {
        const tmsCategory = detectCategory(currentCategoryText);
        if (tmsCategory && tmsCategory !== 'MOTO') {
          if (stationNames.length === 0) {
            warnings.push(`Sin nombre de peaje para categoría "${currentCategoryText}"`);
          } else if (amounts.length === 1 && stationNames.length === 1) {
            rates.push({
              stationName: stationNames[0],
              vehicleCategory: tmsCategory,
              rateAmount: amounts[0],
              rawCategoryText: currentCategoryText,
            });
          } else {
            amounts.forEach((amount, index) => {
              const stationName = stationNames[index] ?? stationNames[0];
              rates.push({
                stationName,
                vehicleCategory: tmsCategory,
                rateAmount: amount,
                rawCategoryText: currentCategoryText,
              });
            });
          }
        }
      }

      currentCategoryText = '';
    } else {
      currentCategoryText += ` ${line}`;
    }
  }

  if (rates.length === 0) {
    warnings.push('Parseo estructurado no encontró datos - aplicando fallback de extracción plana');
    const allPrices = [...text.matchAll(/\$\s*([\d.,]+)/g)].map((match) => parseCLP(match[1]));
    if (allPrices.length > 0 && stationNames.length > 0) {
      const categoriesFound = CATEGORY_MAP
        .filter((entry) => entry.tmsCategory !== 'MOTO')
        .filter((entry) => entry.patterns.some((pattern) => normalize(text).includes(normalize(pattern))));

      if (categoriesFound.length > 0 && allPrices.length >= categoriesFound.length) {
        let index = 0;
        for (const category of categoriesFound) {
          for (const stationName of stationNames) {
            if (index < allPrices.length) {
              rates.push({
                stationName,
                vehicleCategory: category.tmsCategory,
                rateAmount: allPrices[index],
                rawCategoryText: category.patterns[0],
              });
              index += 1;
            }
          }
        }
      }
    }
  }

  if (rates.length === 0) {
    warnings.push(
      'No se pudieron extraer tarifas del PDF. Verifica que el PDF tiene texto seleccionable (no es imagen escaneada).',
    );
  }

  return { concessionName, rates, rawText: text, warnings };
};

const jsonResponse = (req: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(req),
    },
  });

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const authContext = await requireUserRoles(req, ['admin']);
    if ('response' in authContext) {
      return withHeaders(authContext.response, getCorsHeaders(req));
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return jsonResponse(req, { error: 'Se requiere un archivo PDF' }, 400);
    }

    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      return jsonResponse(req, { error: 'El archivo debe ser un PDF' }, 400);
    }

    const { default: pdfParse } = await import('npm:pdf-parse@1.1.1');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const pdfData = await pdfParse(buffer);
    const rawText = pdfData.text || '';

    if (!rawText.trim()) {
      return jsonResponse(req, {
        error: 'No se pudo extraer texto del PDF. El archivo puede ser una imagen escaneada.',
        rates: [],
        warnings: ['PDF sin texto seleccionable'],
      });
    }

    const result = parseMopText(rawText);
    return jsonResponse(req, { success: true, ...result });
  } catch (error: any) {
    console.error('[parse-mop-toll-pdf] error', error);
    return jsonResponse(req, { error: error.message ?? 'Error interno' }, 500);
  }
};

serve(handler);
