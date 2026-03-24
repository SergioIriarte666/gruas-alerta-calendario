import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServices } from '@/hooks/useServices';
import { toast } from 'sonner';

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
}

interface ImportState {
  step: 'idle' | 'uploading' | 'matching' | 'preview' | 'applying' | 'done';
  parsedQuotes: ParsedQuote[];
  matches: MatchedQuoteService[];
  progress: { current: number; total: number; fileName: string };
  error: string | null;
}

const normalizePatente = (p: string | null | undefined) => (p || '').replace(/[-\s]/g, '').toUpperCase();

// Levenshtein distance for fuzzy VIN matching (tolerates OCR errors)
const levenshtein = (a: string, b: string): number => {
  const m = a.length, n = b.length;
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
  usedIds: Set<string>
): Service | null => {
  if (patenteNorm.length < 16) return null;
  let bestMatch: Service | null = null;
  let bestDist = 3;
  for (const s of candidates) {
    if (usedIds.has(s.id)) continue;
    const sNorm = normalizePatente(s.licensePlate);
    if (sNorm.length < 16) continue;
    const d = levenshtein(patenteNorm, sNorm);
    if (d > 0 && d < bestDist) {
      bestDist = d;
      bestMatch = s;
    }
  }
  return bestMatch;
};
const normalizeQuote = (q: string | null | undefined) => (q || '').trim().toUpperCase().replace(/^COT[-\s]*/, '').trim();
const normalizeRut = (r: string | null | undefined) => (r || '').replace(/[.\s-]/g, '').toUpperCase();

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

    setState(prev => ({ ...prev, step: 'uploading', error: null, progress: { current: 0, total: files.length, fileName: '' } }));

    const parsedQuotes: ParsedQuote[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setState(prev => ({ ...prev, progress: { current: i + 1, total: files.length, fileName: file.name } }));

      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let j = 0; j < bytes.length; j++) {
          binary += String.fromCharCode(bytes[j]);
        }
        const base64 = btoa(binary);

        const { data, error } = await supabase.functions.invoke('parse-quote-pdf', {
          body: { pdfBase64: base64 },
        });

        if (error) throw new Error(error.message);
        if (!data) throw new Error('Sin respuesta del servidor');

        parsedQuotes.push({ ...data, fileName: file.name });
      } catch (err: any) {
        console.error(`Error processing ${file.name}:`, err);
        toast.error(`Error procesando ${file.name}: ${err.message}`);
      }
    }

    if (parsedQuotes.length === 0) {
      setState(prev => ({ ...prev, step: 'idle', error: 'No se pudo procesar ningún PDF' }));
      return;
    }

    // Fetch client data for RUT validation
    const { data: clientData } = await supabase
      .from('clients')
      .select('id, name, rut')
      .eq('id', clientId)
      .single();

    const clientRut = normalizeRut(clientData?.rut);

    // Validate RUT: filter out PDFs that belong to a different client
    const validQuotes = parsedQuotes.filter(doc => {
      const docRut = normalizeRut(doc.clientRut);
      if (docRut && clientRut && docRut !== clientRut) {
        toast.error(
          `${doc.fileName}: La cotización pertenece a otro cliente (RUT: ${doc.clientRut}). El cliente actual tiene RUT: ${clientData?.rut}`
        );
        return false;
      }
      return true;
    });

    if (validQuotes.length === 0) {
      setState(prev => ({ ...prev, step: 'idle', error: 'Ningún PDF corresponde a este cliente' }));
      return;
    }

    setState(prev => ({ ...prev, step: 'matching', parsedQuotes: validQuotes }));

    // Fetch fresh services
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
        client: clientDataFresh ? {
          id: clientDataFresh.id, name: clientDataFresh.name, rut: clientDataFresh.rut,
          phone: clientDataFresh.phone || '', email: clientDataFresh.email || '',
          address: clientDataFresh.address || '', department: clientDataFresh.department || 'General',
          isActive: clientDataFresh.is_active, createdAt: '', updatedAt: ''
        } : null,
        purchaseOrder: service.purchase_order,
        purchaseOrderNumber: service.purchase_order_number || '',
        quoteNumber: service.quote_number || '',
        licensePlate: service.license_plate,
        serviceType: service.service_types ? {
          id: service.service_types.id, name: service.service_types.name,
          description: service.service_types.description || '',
          basePrice: service.service_types.base_price, isActive: service.service_types.is_active,
        } : null,
        value: Number(service.value),
        crane: service.cranes ? { id: service.cranes.id, licensePlate: service.cranes.license_plate } : null,
        operator: service.operators ? { id: service.operators.id, name: service.operators.name } : null,
        status: service.status,
        observations: service.observations,
        createdAt: service.created_at,
        updatedAt: service.updated_at,
      })) as Service[];
    } catch (err: any) {
      console.error('Error fetching fresh services:', err);
      clientServices = services.filter(s => s.client?.id === clientId);
    }

    // Candidates: completed or purchase_order_pending (without quote)
    clientServices = clientServices.filter(s =>
      s.status === 'completed' ||
      s.status === 'purchase_order_pending' ||
      s.status === 'quoted' ||
      s.status === 'with_purchase_order' ||
      s.status === 'invoiced'
    );

    const matches: MatchedQuoteService[] = [];
    const usedServiceIds = new Set<string>();

    // Collect all expanded items first, then sort: items with patente first
    const allItems: { item: ParsedQuoteItem; quoteNumber: string; fileName: string }[] = [];

    for (const quote of validQuotes) {
      for (const rawItem of quote.items) {
        const patenteRaw = (rawItem.patente || '').trim();
        const multiPatentes = patenteRaw.split(/[/,]/).map(p => p.trim()).filter(p => p.length > 0);
        
        const expandedItems: ParsedQuoteItem[] = multiPatentes.length > 1
          ? multiPatentes.map(p => ({
              ...rawItem,
              patente: p,
              amount: Math.round(rawItem.amount / multiPatentes.length),
            }))
          : [rawItem];

        for (const item of expandedItems) {
          allItems.push({ item, quoteNumber: quote.quoteNumber, fileName: quote.fileName });
        }
      }
    }

    // Sort: items with patente first, without patente last (priority matching)
    allItems.sort((a, b) => {
      const aHas = normalizePatente(a.item.patente) ? 0 : 1;
      const bHas = normalizePatente(b.item.patente) ? 0 : 1;
      return aHas - bHas;
    });

    for (const { item, quoteNumber, fileName } of allItems) {
        const patenteNorm = normalizePatente(item.patente);

        if (!patenteNorm) {
          // Fallback: match by amount
          if (item.amount > 0) {
            const unitPrice = (item.quantity && item.quantity > 1) ? item.amount / item.quantity : null;
            const serviceByAmount = clientServices.find(s =>
              !usedServiceIds.has(s.id) && !s.quoteNumber && (
                Math.abs(s.value - item.amount) < 1 ||
                (unitPrice !== null && Math.abs(s.value - unitPrice) < 1)
              )
            );
            if (serviceByAmount) {
              usedServiceIds.add(serviceByAmount.id);
              matches.push({
                parsedItem: item,
                service: serviceByAmount,
                quoteNumber,
                fileName,
                status: 'matched',
              });
              continue;
            }
          }
          matches.push({
            parsedItem: item,
            service: null,
            quoteNumber,
            fileName,
            status: 'no_match',
          });
          continue;
        }

        // Match by license plate
        const matchingServices = clientServices
          .filter(s => normalizePatente(s.licensePlate) === patenteNorm && !usedServiceIds.has(s.id))
          .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());

        if (matchingServices.length === 0) {
          // Fuzzy VIN matching (tolerates 1-2 OCR digit errors)
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
            });
          } else {
            matches.push({
              parsedItem: item,
              service: null,
              quoteNumber,
              fileName,
              status: 'no_match',
            });
          }
        } else {
          const serviceWithoutQuote = matchingServices.find(s => !s.quoteNumber);

          if (serviceWithoutQuote) {
            usedServiceIds.add(serviceWithoutQuote.id);
            matches.push({
              parsedItem: item,
              service: serviceWithoutQuote,
              quoteNumber,
              fileName,
              status: 'matched',
            });
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
            });
          }
        }
    }

    setState(prev => ({ ...prev, step: 'preview', matches }));
  }, [clientId, services]);

  const applyMatches = useCallback(async (selectedMatches: MatchedQuoteService[]) => {
    const validMatches = selectedMatches.filter(m => (m.status === 'matched' || m.status === 'already_has_quote') && m.service);
    if (validMatches.length === 0) {
      toast.error('No hay servicios válidos para actualizar');
      return;
    }

    setState(prev => ({ ...prev, step: 'applying', progress: { current: 0, total: validMatches.length, fileName: '' } }));

    let successCount = 0;
    for (let i = 0; i < validMatches.length; i++) {
      const match = validMatches[i];
      try {
        const normalized = normalizeQuote(match.quoteNumber);
        const formattedQuote = `COT-${normalized}`;
        await updateService(match.service!.id, {
          quoteNumber: formattedQuote,
          status: 'quoted' as any,
        });
        successCount++;
        setState(prev => ({ ...prev, progress: { current: i + 1, total: validMatches.length, fileName: match.parsedItem.patente } }));
      } catch (err: any) {
        console.error(`Error updating service ${match.service!.folio}:`, err);
      }
    }

    setState(prev => ({ ...prev, step: 'done' }));
    toast.success(`${successCount} de ${validMatches.length} servicios actualizados con cotización`);
  }, [updateService]);

  return { state, processFiles, applyMatches, reset };
}
