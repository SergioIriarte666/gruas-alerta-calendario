import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServices } from '@/hooks/useServices';
import { toast } from 'sonner';
import { disableVipPdfAiForSession, invokeEdgeFunctionJson, isVipPdfAiDisabled } from '@/utils/vipPdfImportClient';
import { extractPurchaseOrderDataLocally } from '@/utils/localVipPdfParser';
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


export interface ParsedOCItem {
  patente: string;
  detail: string;
  amount: number;
  quantity?: number;
}

export interface ParsedOC {
  ocNumber: string;
  date: string | null;
  items: ParsedOCItem[];
  totals: { neto: number; iva: number; total: number };
  quoteReference: string;
  clientRut: string;
  rawText: string;
  fileName: string;
}

export interface MatchedService {
  parsedItem: ParsedOCItem;
  service: Service | null;
  ocNumber: string;
  fileName: string;
  status: 'matched' | 'no_match' | 'already_has_oc' | 'same_oc';
}

interface ImportState {
  step: 'idle' | 'uploading' | 'matching' | 'preview' | 'applying' | 'done';
  parsedOCs: ParsedOC[];
  matches: MatchedService[];
  progress: { current: number; total: number; fileName: string };
  error: string | null;
}

const normalizePatente = (p: string | null | undefined) => (p || '').replace(/[-\s]/g, '').toUpperCase();
const normalizeOC = (oc: string | null | undefined) => (oc || '').replace(/^OC-/i, '').trim();
const normalizeText = (text: string | null | undefined) =>
  (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const normalizeRut = (rut: string | null | undefined) => (rut || '').replace(/[.\s-]/g, '').toUpperCase();

const normalizeSpaces = (value: string) => value.replace(/\s+/g, ' ').trim();

const sanitizeParsedOC = (doc: Omit<ParsedOC, 'fileName'>): Omit<ParsedOC, 'fileName'> => {
  const items = Array.isArray(doc.items) ? doc.items : [];

  const cleaned = items
    .map((item) => ({
      patente: (item.patente || '').trim(),
      detail: normalizeSpaces(item.detail || ''),
      amount: Number.isFinite(item.amount) ? Math.max(0, Math.round(item.amount)) : 0,
      quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
    }))
    .filter((item) => item.patente || item.detail || item.amount > 0);

  const grouped = new Map<string, ParsedOCItem[]>();
  for (const item of cleaned) {
    const key = (item.patente || '').replace(/[-\s]/g, '').toUpperCase();
    if (!key) continue;
    const current = grouped.get(key) ?? [];
    current.push(item);
    grouped.set(key, current);
  }

  const deduped: ParsedOCItem[] = [];
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

    const best = filteredByDetail.reduce<ParsedOCItem | null>((acc, current) => {
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
    ocNumber: (doc.ocNumber || '').trim(),
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

export function usePurchaseOrderPDFImport(clientId: string | null, services: Service[]) {
  const { updateService } = useServices();
  const [state, setState] = useState<ImportState>({
    step: 'idle',
    parsedOCs: [],
    matches: [],
    progress: { current: 0, total: 0, fileName: '' },
    error: null,
  });

  const reset = useCallback(() => {
    setState({
      step: 'idle',
      parsedOCs: [],
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

    const parsedOCs: ParsedOC[] = [];
    let lastErrorMessage: string | null = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setState((prev) => ({
        ...prev,
        progress: { current: i + 1, total: files.length, fileName: file.name },
      }));

      try {
        const buffer = await file.arrayBuffer();

        let parsed: Omit<ParsedOC, 'fileName'>;

        try {
          if (isVipPdfAiDisabled()) {
            throw new Error('Lectura IA deshabilitada');
          }
          const pdfText = await extractPdfText(buffer);
          parsed = await invokeEdgeFunctionJson<Omit<ParsedOC, 'fileName'>>('parse-purchase-order-pdf', {
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
            const localParsed = await extractPurchaseOrderDataLocally(file);
            if (!localParsed.items.length) {
              throw new Error('No se encontraron ítems utilizables en el PDF');
            }
            parsed = localParsed;
          } catch (localError: unknown) {
            throw new Error(buildVipPdfImportError(remoteError, localError));
          }
        }

        parsed = sanitizeParsedOC(parsed);
        parsedOCs.push({ ...parsed, fileName: file.name });
      } catch (err: any) {
        console.error(`Error processing ${file.name}:`, err);
        lastErrorMessage = err?.message || 'No se pudo procesar el PDF';
        toast.error(`Error procesando ${file.name}`, {
          description: err?.message || 'No se pudo procesar el PDF',
        });
      }
    }

    if (parsedOCs.length === 0) {
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

    const validOCs = parsedOCs.filter((doc) => {
      const docRut = normalizeRut(doc.clientRut);
      if (docRut && clientRut && docRut !== clientRut) {
        toast.error(`${doc.fileName}: La OC pertenece a otro cliente (RUT: ${doc.clientRut}). El cliente actual tiene RUT: ${clientData?.rut}`);
        return false;
      }
      return true;
    });

    if (validOCs.length === 0) {
      setState((prev) => ({ ...prev, step: 'idle', error: 'Ningún PDF corresponde a este cliente' }));
      return;
    }

    setState((prev) => ({ ...prev, step: 'matching', parsedOCs: validOCs }));

    let clientServices: Service[] = [];
    try {
      const { data: freshData, error: freshError } = await supabase
        .from('services')
        .select(`
          *,
          cranes(id, license_plate, brand, model, type, is_active),
          operators(id, name, rut, phone, license_number, is_active),
          service_types(id, name, description, base_price, is_active, vehicle_info_optional, purchase_order_required, origin_required, destination_required, crane_required, operator_required, vehicle_brand_required, vehicle_model_required, license_plate_required, created_at, updated_at)
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
      service.status === 'quoted' ||
      service.status === 'purchase_order_pending' ||
      service.status === 'completed' ||
      service.status === 'with_purchase_order' ||
      service.status === 'invoiced',
    );

    const matches: MatchedService[] = [];
    const usedServiceIds = new Set<string>();

    const allItems = validOCs.flatMap((oc) =>
      oc.items.map((item) => ({ item, ocNumber: oc.ocNumber, fileName: oc.fileName, quoteReference: oc.quoteReference })),
    );

    allItems.sort((a, b) => {
      const aHas = normalizePatente(a.item.patente) ? 0 : 1;
      const bHas = normalizePatente(b.item.patente) ? 0 : 1;
      return aHas - bHas;
    });

    for (const { item, ocNumber, fileName, quoteReference } of allItems) {
      const patenteNorm = normalizePatente(item.patente);

      if (!patenteNorm) {
        const ocNorm = normalizeOC(ocNumber);
        const serviceWithSameOC = clientServices.find((service) =>
          !usedServiceIds.has(service.id) &&
          (normalizeOC(service.purchaseOrder) === ocNorm || normalizeOC(service.purchaseOrderNumber) === ocNorm),
        );

        if (serviceWithSameOC) {
          usedServiceIds.add(serviceWithSameOC.id);
          matches.push({ parsedItem: item, service: serviceWithSameOC, ocNumber, fileName, status: 'same_oc' });
          continue;
        }

        if (quoteReference) {
          const quoteRef = quoteReference.replace(/\D/g, '');
          if (quoteRef) {
            const servicesByQuote = clientServices.filter((service) =>
              !usedServiceIds.has(service.id) &&
              service.quoteNumber &&
              service.quoteNumber.replace(/\D/g, '') === quoteRef,
            );

            if (servicesByQuote.length > 0) {
              for (const service of servicesByQuote) {
                usedServiceIds.add(service.id);
                matches.push({ parsedItem: item, service, ocNumber, fileName, status: 'matched' });
              }
              continue;
            }
          }
        }

        const glosaNorm = normalizeText(item.detail);
        if (glosaNorm) {
          const candidatesByGlosa = clientServices.filter((service) =>
            !usedServiceIds.has(service.id) &&
            !service.purchaseOrder &&
            !service.purchaseOrderNumber &&
            service.serviceType?.name &&
            (normalizeText(service.serviceType.name).includes(glosaNorm) || glosaNorm.includes(normalizeText(service.serviceType.name))),
          );

          if (candidatesByGlosa.length > 0) {
            const best = item.amount > 0
              ? candidatesByGlosa.sort((a, b) => Math.abs(a.value - item.amount) - Math.abs(b.value - item.amount))[0]
              : candidatesByGlosa[0];
            usedServiceIds.add(best.id);
            matches.push({ parsedItem: item, service: best, ocNumber, fileName, status: 'matched' });
            continue;
          }
        }

        if (item.amount > 0) {
          const unitPrice = item.quantity && item.quantity > 1 ? item.amount / item.quantity : null;
          const serviceByAmount = clientServices.find((service) =>
            !usedServiceIds.has(service.id) &&
            !service.purchaseOrder &&
            !service.purchaseOrderNumber &&
            (Math.abs(service.value - item.amount) < 1 ||
              (unitPrice !== null && Math.abs(service.value - unitPrice) < 1)),
          );

          if (serviceByAmount) {
            usedServiceIds.add(serviceByAmount.id);
            matches.push({ parsedItem: item, service: serviceByAmount, ocNumber, fileName, status: 'matched' });
            continue;
          }
        }

        matches.push({ parsedItem: item, service: null, ocNumber, fileName, status: 'no_match' });
        continue;
      }

      const matchingServices = clientServices
        .filter((service) => normalizePatente(service.licensePlate) === patenteNorm && !usedServiceIds.has(service.id))
        .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());

      if (matchingServices.length === 0) {
        const fuzzyMatch = findFuzzyVinMatch(patenteNorm, clientServices, usedServiceIds);
        if (fuzzyMatch) {
          const hasOC = fuzzyMatch.purchaseOrderNumber || fuzzyMatch.purchaseOrder;
          usedServiceIds.add(fuzzyMatch.id);
          matches.push({
            parsedItem: item,
            service: fuzzyMatch,
            ocNumber,
            fileName,
            status: hasOC ? 'already_has_oc' : 'matched',
          });
        } else {
          matches.push({ parsedItem: item, service: null, ocNumber, fileName, status: 'no_match' });
        }
      } else {
        const serviceWithoutOC = matchingServices.find((service) => !service.purchaseOrderNumber && !service.purchaseOrder);

        if (serviceWithoutOC) {
          usedServiceIds.add(serviceWithoutOC.id);
          matches.push({ parsedItem: item, service: serviceWithoutOC, ocNumber, fileName, status: 'matched' });
        } else {
          const topService = matchingServices[0];
          const hasSameOC = normalizeOC(topService.purchaseOrder) === normalizeOC(ocNumber) || normalizeOC(topService.purchaseOrderNumber) === normalizeOC(ocNumber);
          usedServiceIds.add(topService.id);
          matches.push({
            parsedItem: item,
            service: topService,
            ocNumber,
            fileName,
            status: hasSameOC ? 'same_oc' : 'already_has_oc',
          });
        }
      }
    }

    setState((prev) => ({ ...prev, step: 'preview', matches }));
  }, [clientId, services]);

  const applyMatches = useCallback(async (selectedMatches: MatchedService[]) => {
    const validMatches = selectedMatches.filter((match) => (match.status === 'matched' || match.status === 'already_has_oc') && match.service);
    if (validMatches.length === 0) {
      toast.error('No hay servicios válidos para actualizar');
      return;
    }

    setState((prev) => ({ ...prev, step: 'applying', progress: { current: 0, total: validMatches.length, fileName: '' } }));

    let successCount = 0;
    for (let i = 0; i < validMatches.length; i++) {
      const match = validMatches[i];
      try {
        const formattedOC = match.ocNumber.startsWith('OC-') ? match.ocNumber : `OC-${match.ocNumber}`;
        await updateService(match.service!.id, {
          purchaseOrder: formattedOC,
          status: 'with_purchase_order' as any,
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
    toast.success(`${successCount} de ${validMatches.length} servicios actualizados con OC`);
  }, [updateService]);

  return { state, processFiles, applyMatches, reset };
}
