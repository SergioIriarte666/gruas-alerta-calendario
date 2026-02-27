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
const normalizeQuote = (q: string | null | undefined) => (q || '').trim().toUpperCase().replace(/^COT[-\s]*/, '').trim();

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

    setState(prev => ({ ...prev, step: 'matching', parsedQuotes }));

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

      const { data: clientData } = await supabase
        .from('clients')
        .select('id, name, rut, phone, email, address, department, is_active')
        .eq('id', clientId)
        .single();

      clientServices = (freshData || []).map((service: any) => ({
        id: service.id,
        folio: service.folio,
        requestDate: service.request_date,
        serviceDate: service.service_date,
        client: clientData ? {
          id: clientData.id, name: clientData.name, rut: clientData.rut,
          phone: clientData.phone || '', email: clientData.email || '',
          address: clientData.address || '', department: clientData.department || 'General',
          isActive: clientData.is_active, createdAt: '', updatedAt: ''
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

    for (const quote of parsedQuotes) {
      for (const rawItem of quote.items) {
        // Split multiple patentes separated by "/" or ","
        const patenteRaw = (rawItem.patente || '').trim();
        const multiPatentes = patenteRaw.split(/[\/,]/).map(p => p.trim()).filter(p => p.length > 0);
        
        const expandedItems: ParsedQuoteItem[] = multiPatentes.length > 1
          ? multiPatentes.map(p => ({
              ...rawItem,
              patente: p,
              amount: Math.round(rawItem.amount / multiPatentes.length),
            }))
          : [rawItem];

        for (const item of expandedItems) {
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
                quoteNumber: quote.quoteNumber,
                fileName: quote.fileName,
                status: 'matched',
              });
              continue;
            }
          }
          matches.push({
            parsedItem: item,
            service: null,
            quoteNumber: quote.quoteNumber,
            fileName: quote.fileName,
            status: 'no_match',
          });
          continue;
        }

        // Match by license plate
        const matchingServices = clientServices
          .filter(s => normalizePatente(s.licensePlate) === patenteNorm && !usedServiceIds.has(s.id))
          .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());

        if (matchingServices.length === 0) {
          matches.push({
            parsedItem: item,
            service: null,
            quoteNumber: quote.quoteNumber,
            fileName: quote.fileName,
            status: 'no_match',
          });
        } else {
          const serviceWithoutQuote = matchingServices.find(s => !s.quoteNumber);

          if (serviceWithoutQuote) {
            usedServiceIds.add(serviceWithoutQuote.id);
            matches.push({
              parsedItem: item,
              service: serviceWithoutQuote,
              quoteNumber: quote.quoteNumber,
              fileName: quote.fileName,
              status: 'matched',
            });
          } else {
            const topService = matchingServices[0];
            const hasSameQuote = normalizeQuote(topService.quoteNumber) === normalizeQuote(quote.quoteNumber);
            usedServiceIds.add(topService.id);
            matches.push({
              parsedItem: item,
              service: topService,
              quoteNumber: quote.quoteNumber,
              fileName: quote.fileName,
              status: hasSameQuote ? 'same_quote' : 'already_has_quote',
            });
          }
        }
        } // end for expandedItems
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
