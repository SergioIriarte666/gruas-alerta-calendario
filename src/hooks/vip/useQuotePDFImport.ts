import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServices } from '@/hooks/useServices';
import { toast } from 'sonner';
import { disableVipPdfAiForSession, invokeEdgeFunctionJson, isVipPdfAiDisabled } from '@/utils/vipPdfImportClient';
import { extractQuoteDataLocally } from '@/utils/localVipPdfParser';
import { buildVipPdfImportError } from '@/utils/vipPdfImportErrors';
import { loadPdfJsCompat } from '@/utils/loadPdfJsCompat';

const extractPdfText = async (buffer: ArrayBuffer): Promise<string> => {
  const pdfJs = await loadPdfJsCompat();
  const pdf = await pdfJs.getDocument({ data: new Uint8Array(buffer) }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str: string }>;
    fullText += items.map(item => item.str).join(' ') + '\n';
  }
  return fullText;
};

export interface ParsedQuoteItem {
  patente: string;
  detail: string;
  amount: number;
  quantity?: number;
}

export interface ParsedQuote {
  quoteNumber: string;
  date: string | null;
  items: ParsedQuoteItem[];
  totals: { neto: number; iva: number; total: number };
  clientRut: string;
  rawText: string;
  fileName: string;
}

export interface MatchedQuoteService {
  parsedItem: ParsedQuoteItem;
  service: Service | null;
  quoteNumber: string;
  fileName: string;
  status: 'matched' | 'no_match' | 'already_has_quote' | 'same_quote';
  candidates?: Service[];
}

interface ImportState {
  step: 'idle' | 'uploading' | 'matching' | 'preview' | 'applying' | 'done';
  parsedQuotes: ParsedQuote[];
  matches: MatchedQuoteService[];
  progress: { current: number; total: number; fileName: string };
  error: string | null;
}

const normalizePatente = (p: string | null | undefined) => (p || '').replace(/[-\s]/g, '').toUpperCase();
const normalizeQuote = (q: string | null | undefined) => (q || '').trim().toUpperCase().replace(/^COT[-\s]*/, '').trim();
const normalizeRut = (r: string | null | undefined) => (r || '').replace(/[.\s-]/g, '').toUpperCase();

const normalizeSpaces = (value: string) => value.replace(/\s+/g, ' ').trim();

const sanitizeParsedQuote = (doc: Omit<ParsedQuote, 'fileName'>): Omit<ParsedQuote, 'fileName'> => {
  const items = Array.isArray(doc.items) ? doc.items : [];

  const cleaned = items
    .map((item) => ({
      patente: (item.patente || '').trim(),
      detail: normalizeSpaces(item.detail || ''),
      amount: Number.isFinite(item.amount) ? Math.max(0, Math.round(item.amount)) : 0,
      quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
    }))
    .filter((item) => item.patente || item.detail || item.amount > 0);

  const grouped = new Map<string, ParsedQuoteItem[]>();
  for (const item of cleaned) {
    const key = (item.patente || '').replace(/[-\s]/g, '').toUpperCase();
    if (!key) continue;
    const current = grouped.get(key) ?? [];
    current.push(item);
    grouped.set(key, current);
  }

  const deduped: ParsedQuoteItem[] = [];
  for (const [patenteKey, group] of grouped.entries()) {
    const hasPositive = group.some((i) => (i.amount || 0) > 0);
    const filtered = hasPositive ? group.filter((i) => (i.amount || 0) > 0) : group;
    const hasStrongDetail = filtered.some((i) => {
      const d = (i.detail || '').replace(/[-\s]/g, '').toUpperCase();
      return d.length >= 8 && d !== patenteKey;
    });
    const filteredByDetail = hasStrongDetail
      ? filtered.filter((i) => {
          const d = (i.detail || '').replace(/[-\s]/g, '').toUpperCase();
          return d.length >= 8 && d !== patenteKey;
        })
      : filtered;

    const best = filteredByDetail.reduce<ParsedQuoteItem | null>((acc, current) => {
      if (!acc) return current;
      const accAmount = acc.amount || 0;
      const curAmount = current.amount || 0;
      if (curAmount !== accAmount) return curAmount > accAmount ? current : acc;
      return (current.detail || '').length > (acc.detail || '').length ? current : acc;
    }, null);

    if (best) deduped.push(best);
  }

  const totals = doc.totals || { neto: 0, iva: 0, total: 0 };
  const neto = Number.isFinite(totals.neto) ? Math.max(0, Math.round(totals.neto)) : 0;
  const total = Number.isFinite(totals.total) ? Math.max(0, Math.round(totals.total)) : 0;
  const target = total > 0 ? total : neto > 0 ? neto : 0;

  const sumItems = deduped.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? (item.amount || 0) : 0), 0);
  if (target > 0 && sumItems > target * 5) {
    const ratio = sumItems / target;
    const candidates = [10, 100, 1000];
    const factor = candidates.find((c) => Math.abs(ratio - c) / c < 0.15);
    if (factor) {
      for (const item of deduped) {
        item.amount = Math.max(0, Math.round((item.amount || 0) / factor));
      }
    }
  }

  return {
    ...doc,
    quoteNumber: (doc.quoteNumber || '').trim(),
    clientRut: doc.clientRut || '',
    rawText: doc.rawText || '',
    items: deduped,
    totals: { ...totals, neto, total },
  };
};

const levenshtein = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    prev = curr;
  }
  return prev[n];
};

const findFuzzyVinMatch = (
  patenteNorm: string,
  candidates: Service[],
  usedIds: Set<string>,
): Service | null => {
  if (patenteNorm.length < 16) return null;

  let bestMatch: Service | null = null;
  let bestDist = 3;

  for (const service of candidates) {
    if (usedIds.has(service.id)) continue;
    const serviceNorm = normalizePatente(service.licensePlate);
    if (serviceNorm.length < 16) continue;

    const distance = levenshtein(patenteNorm, serviceNorm);
    if (distance > 0 && distance < bestDist) {
      bestDist = distance;
      bestMatch = service;
    }
  }

  return bestMatch;
};

export function useQuotePDFImport(clientId: string | null, services: Service[]) {
  const { updateService } = useServices();
  const [state, setState] = useState<ImportState>({
    step: 'idle',
    parsedQuotes: [],
    matches: [],
    progress: { current: 0, total: 0, fileName: '' },
    error: null,
  });

  const reset = useCallback(() => {
    setState({
      step: 'idle',
      parsedQuotes: [],
      matches: [],
      progress: { current: 0, total: 0, fileName: '' },
      error: null,
    });
  }, []);

  const processFiles = useCallback(async (files: File[]) => {
    if (!clientId) return;

    setState((prev) => ({
      ...prev,
      step: 'uploading',
      error: null,
      progress: { current: 0, total: files.length, fileName: '' },
    }));

    const parsedQuotes: ParsedQuote[] = [];
    let lastErrorMessage: string | null = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setState((prev) => ({
        ...prev,
        progress: { current: i + 1, total: files.length, fileName: file.name },
      }));

      try {
        const buffer = await file.arrayBuffer();

        let parsed: Omit<ParsedQuote, 'fileName'>;

        try {
          if (isVipPdfAiDisabled()) {
            throw new Error('Lectura IA deshabilitada');
          }
          const pdfText = await extractPdfText(buffer);
          parsed = await invokeEdgeFunctionJson<Omit<ParsedQuote, 'fileName'>>('parse-quote-pdf', {
            pdfText,
          });
          if (!parsed.items?.length) {
            throw new Error('No se encontraron ítems utilizables en el PDF');
          }
        } catch (remoteError: unknown) {
          const remoteMessage = remoteError instanceof Error ? remoteError.message : String(remoteError || '');
          if (/Falta configurar la clave del gateway de IA|Invalid API key format|Error de autenticación con el gateway de IA/i.test(remoteMessage)) {
            disableVipPdfAiForSession();
          }
          try {
            const localParsed = await extractQuoteDataLocally(file);
            if (!localParsed.items.length) {
              throw new Error('No se encontraron ítems utilizables en el PDF');
            }
            parsed = localParsed;
          } catch (localError: unknown) {
            throw new Error(buildVipPdfImportError(remoteError, localError));
          }
        }

        parsed = sanitizeParsedQuote(parsed);
        parsedQuotes.push({ ...parsed, fileName: file.name });
      } catch (err: any) {
        console.error(`Error processing ${file.name}:`, err);
        lastErrorMessage = err?.message || 'No se pudo procesar el PDF';
        toast.error(`Error procesando ${file.name}`, {
          description: err?.message || 'No se pudo procesar el PDF',
        });
      }
    }

    if (parsedQuotes.length === 0) {
      setState((prev) => ({
        ...prev,
        step: 'idle',
        error: lastErrorMessage || 'No se pudo procesar ningún PDF',
      }));
      return;
    }

    const { data: clientData } = await supabase
      .from('clients')
      .select('id, name, rut')
      .eq('id', clientId)
      .single();

    const clientRut = normalizeRut(clientData?.rut);

    const validQuotes = parsedQuotes.filter((doc) => {
      const docRut = normalizeRut(doc.clientRut);
      if (docRut && clientRut && docRut !== clientRut) {
        toast.error(`${doc.fileName}: La cotización pertenece a otro cliente (RUT: ${doc.clientRut}). El cliente actual tiene RUT: ${clientData?.rut}`);
        return false;
      }
      return true;
    });

    if (validQuotes.length === 0) {
      setState((prev) => ({ ...prev, step: 'idle', error: 'Ningún PDF corresponde a este cliente' }));
      return;
    }

    setState((prev) => ({ ...prev, step: 'matching', parsedQuotes: validQuotes }));

    let clientServices: Service[] = [];
    try {
      const { data: freshData, error: freshError } = await supabase
        .from('services')
        .select(`
          *,
          cranes(id, license_plate, brand, model, type, is_active),
          operators(id, name, rut, phone, license_number, is_active),
          service_types(id, name, description, base_price, is_active)
        `)
        .eq('client_id', clientId)
        .order('service_date', { ascending: false });

      if (freshError) throw freshError;

      const { data: clientDataFresh } = await supabase
        .from('clients')
        .select('id, name, rut, phone, email, address, department, is_active')
        .eq('id', clientId)
        .single();

      clientServices = (freshData || []).map((service: any) => ({
        id: service.id,
        folio: service.folio,
        requestDate: service.request_date,
        serviceDate: service.service_date,
        client: clientDataFresh
          ? {
              id: clientDataFresh.id,
              name: clientDataFresh.name,
              rut: clientDataFresh.rut,
              phone: clientDataFresh.phone || '',
              email: clientDataFresh.email || '',
              address: clientDataFresh.address || '',
              department: clientDataFresh.department || 'General',
              isActive: clientDataFresh.is_active,
              createdAt: '',
              updatedAt: '',
            }
          : null,
        purchaseOrder: service.purchase_order,
        purchaseOrderNumber: service.purchase_order_number || '',
        quoteNumber: service.quote_number || '',
        licensePlate: service.license_plate,
        serviceType: service.service_types
          ? {
              id: service.service_types.id,
              name: service.service_types.name,
              description: service.service_types.description || '',
              basePrice: service.service_types.base_price,
              isActive: service.service_types.is_active,
            }
          : null,
        value: Number(service.value),
        crane: service.cranes ? { id: service.cranes.id, licensePlate: service.cranes.license_plate } : null,
        operator: service.operators ? { id: service.operators.id, name: service.operators.name } : null,
        status: service.status,
        observations: service.observations,
        createdAt: service.created_at,
        updatedAt: service.updated_at,
      })) as Service[];
    } catch (err) {
      console.error('Error fetching fresh services:', err);
      clientServices = services.filter((service) => service.client?.id === clientId);
    }

    clientServices = clientServices.filter((service) =>
      service.status === 'completed' ||
      service.status === 'purchase_order_pending' ||
      service.status === 'quoted' ||
      service.status === 'with_purchase_order' ||
      service.status === 'invoiced',
    );

    const matches: MatchedQuoteService[] = [];
    const usedServiceIds = new Set<string>();
    const allItems: { item: ParsedQuoteItem; quoteNumber: string; fileName: string }[] = [];

    for (const quote of validQuotes) {
      for (const rawItem of quote.items) {
        const patenteRaw = (rawItem.patente || '').trim();
        const multiPatentes = patenteRaw.split(/[/,]/).map((value) => value.trim()).filter(Boolean);

        const expandedItems = multiPatentes.length > 1
          ? multiPatentes.map((patente) => ({
              ...rawItem,
              patente,
              amount: Math.round(rawItem.amount / multiPatentes.length),
            }))
          : [rawItem];

        for (const item of expandedItems) {
          allItems.push({ item, quoteNumber: quote.quoteNumber, fileName: quote.fileName });
        }
      }
    }

    allItems.sort((a, b) => {
      const aHas = normalizePatente(a.item.patente) ? 0 : 1;
      const bHas = normalizePatente(b.item.patente) ? 0 : 1;
      return aHas - bHas;
    });

    for (const { item, quoteNumber, fileName } of allItems) {
      const patenteNorm = normalizePatente(item.patente);

      if (!patenteNorm) {
        if (item.amount > 0) {
          const unitPrice = item.quantity && item.quantity > 1 ? item.amount / item.quantity : null;
          const serviceByAmount = clientServices.find((service) =>
            !usedServiceIds.has(service.id) &&
            !service.quoteNumber &&
            (Math.abs(service.value - item.amount) < 1 ||
              (unitPrice !== null && Math.abs(service.value - unitPrice) < 1)),
          );

          if (serviceByAmount) {
            usedServiceIds.add(serviceByAmount.id);
            matches.push({ parsedItem: item, service: serviceByAmount, quoteNumber, fileName, status: 'matched' });
            continue;
          }
        }

        matches.push({ parsedItem: item, service: null, quoteNumber, fileName, status: 'no_match' });
        continue;
      }

      const matchingServices = clientServices
        .filter((service) => normalizePatente(service.licensePlate) === patenteNorm && !usedServiceIds.has(service.id))
        .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());

      const allPatenteCandidates = clientServices
        .filter((service) => normalizePatente(service.licensePlate) === patenteNorm)
        .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());

      if (matchingServices.length === 0) {
        const fuzzyMatch = findFuzzyVinMatch(patenteNorm, clientServices, usedServiceIds);
        if (fuzzyMatch) {
          const hasQuote = !!fuzzyMatch.quoteNumber;
          usedServiceIds.add(fuzzyMatch.id);
          matches.push({
            parsedItem: item,
            service: fuzzyMatch,
            quoteNumber,
            fileName,
            status: hasQuote ? 'already_has_quote' : 'matched',
            candidates: allPatenteCandidates.length > 0 ? allPatenteCandidates : [fuzzyMatch],
          });
        } else {
          matches.push({ parsedItem: item, service: null, quoteNumber, fileName, status: 'no_match', candidates: allPatenteCandidates });
        }
      } else {
        const serviceWithoutQuote = matchingServices.find((service) => !service.quoteNumber);

        if (serviceWithoutQuote) {
          usedServiceIds.add(serviceWithoutQuote.id);
          matches.push({ parsedItem: item, service: serviceWithoutQuote, quoteNumber, fileName, status: 'matched', candidates: allPatenteCandidates });
        } else {
          const topService = matchingServices[0];
          const hasSameQuote = normalizeQuote(topService.quoteNumber) === normalizeQuote(quoteNumber);
          usedServiceIds.add(topService.id);
          matches.push({
            parsedItem: item,
            service: topService,
            quoteNumber,
            fileName,
            status: hasSameQuote ? 'same_quote' : 'already_has_quote',
            candidates: allPatenteCandidates,
          });
        }
      }
    }

    setState((prev) => ({ ...prev, step: 'preview', matches }));
  }, [clientId, services]);

  const reassignMatch = useCallback((index: number, serviceId: string) => {
    setState((prev) => {
      const match = prev.matches[index];
      if (!match) return prev;
      const newService = match.candidates?.find((s) => s.id === serviceId) ?? null;
      if (!newService) return prev;
      const existingQuote = normalizeQuote(newService.quoteNumber);
      const incomingQuote = normalizeQuote(match.quoteNumber);
      let status: MatchedQuoteService['status'];
      if (!existingQuote) status = 'matched';
      else if (existingQuote === incomingQuote) status = 'same_quote';
      else status = 'already_has_quote';
      const next = [...prev.matches];
      next[index] = { ...match, service: newService, status };
      return { ...prev, matches: next };
    });
  }, []);

  const applyMatches = useCallback(async (selectedMatches: MatchedQuoteService[]) => {
    const validMatches = selectedMatches.filter((match) => (match.status === 'matched' || match.status === 'already_has_quote') && match.service);
    if (validMatches.length === 0) {
      toast.error('No hay servicios válidos para actualizar');
      return;
    }

    setState((prev) => ({ ...prev, step: 'applying', progress: { current: 0, total: validMatches.length, fileName: '' } }));

    let successCount = 0;
    for (let i = 0; i < validMatches.length; i++) {
      const match = validMatches[i];
      try {
        const formattedQuote = `COT-${normalizeQuote(match.quoteNumber)}`;
        await updateService(match.service!.id, {
          quoteNumber: formattedQuote,
          status: 'quoted' as any,
        });
        successCount += 1;
        setState((prev) => ({
          ...prev,
          progress: { current: i + 1, total: validMatches.length, fileName: match.parsedItem.patente },
        }));
      } catch (err) {
        console.error(`Error updating service ${match.service!.folio}:`, err);
      }
    }

    setState((prev) => ({ ...prev, step: 'done' }));
    toast.success(`${successCount} de ${validMatches.length} servicios actualizados con cotización`);
  }, [updateService]);

  return { state, processFiles, applyMatches, reset, reassignMatch };
}
