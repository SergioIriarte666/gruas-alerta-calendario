import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServices } from '@/hooks/useServices';
import { toast } from 'sonner';

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
  let bestDist = 3; // threshold: max 2
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
const normalizeOC = (oc: string | null | undefined) => (oc || '').replace(/^OC-/i, '').trim();
const normalizeText = (t: string | null | undefined) =>
  (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const normalizeRut = (r: string | null | undefined) => (r || '').replace(/[.\s-]/g, '').toUpperCase();

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

    setState(prev => ({ ...prev, step: 'uploading', error: null, progress: { current: 0, total: files.length, fileName: '' } }));

    const parsedOCs: ParsedOC[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setState(prev => ({ ...prev, progress: { current: i + 1, total: files.length, fileName: file.name } }));

      try {
        // Convert file to base64
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let j = 0; j < bytes.length; j++) {
          binary += String.fromCharCode(bytes[j]);
        }
        const base64 = btoa(binary);

        // Call edge function
        const { data, error } = await supabase.functions.invoke('parse-purchase-order-pdf', {
          body: { pdfBase64: base64 },
        });

        if (error) throw new Error(error.message);
        if (!data) throw new Error('Sin respuesta del servidor');

        parsedOCs.push({ ...data, fileName: file.name });
      } catch (err: any) {
        console.error(`Error processing ${file.name}:`, err);
        toast.error(`Error procesando ${file.name}: ${err.message}`);
      }
    }

    if (parsedOCs.length === 0) {
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
    const validOCs = parsedOCs.filter(doc => {
      const docRut = normalizeRut(doc.clientRut);
      if (docRut && clientRut && docRut !== clientRut) {
        toast.error(
          `${doc.fileName}: La OC pertenece a otro cliente (RUT: ${doc.clientRut}). El cliente actual tiene RUT: ${clientData?.rut}`
        );
        return false;
      }
      return true;
    });

    if (validOCs.length === 0) {
      setState(prev => ({ ...prev, step: 'idle', error: 'Ningún PDF corresponde a este cliente' }));
      return;
    }

    // Now match against existing services - fetch fresh data from DB
    setState(prev => ({ ...prev, step: 'matching', parsedOCs: validOCs }));

    // Fresh fetch to avoid stale cache after OC deletions
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
      // Fallback to prop services if fresh fetch fails
      clientServices = services.filter(s => s.client?.id === clientId);
    }
    // Solo servicios completados o con OC son candidatos (excluir pending, in_progress, quoted, invoiced, etc.)
    clientServices = clientServices.filter(s => 
      s.status === 'quoted' || 
      s.status === 'purchase_order_pending' || 
      s.status === 'completed' || 
      s.status === 'with_purchase_order' ||
      s.status === 'invoiced'
    );

    const matches: MatchedService[] = [];
    const usedServiceIds = new Set<string>();

    // Collect all items into a flat list and sort: items WITH patente/VIN first
    const allItems = validOCs.flatMap(oc => 
      oc.items.map(item => ({ item, ocNumber: oc.ocNumber, fileName: oc.fileName, quoteReference: oc.quoteReference }))
    );
    allItems.sort((a, b) => {
      const aHas = normalizePatente(a.item.patente) ? 0 : 1;
      const bHas = normalizePatente(b.item.patente) ? 0 : 1;
      return aHas - bHas;
    });

    for (const { item, ocNumber, fileName, quoteReference } of allItems) {
        const patenteNorm = normalizePatente(item.patente);

        // If patente is empty, use fallback matching
        if (!patenteNorm) {
          const ocNorm = normalizeOC(ocNumber);
          
          // Fallback 1: Find services with the same OC already assigned
          const serviceWithSameOC = clientServices.find(s => 
            !usedServiceIds.has(s.id) && (normalizeOC(s.purchaseOrder) === ocNorm || normalizeOC(s.purchaseOrderNumber) === ocNorm)
          );
          
          if (serviceWithSameOC) {
            usedServiceIds.add(serviceWithSameOC.id);
            matches.push({
              parsedItem: item,
              service: serviceWithSameOC,
              ocNumber,
              fileName,
              status: 'same_oc',
            });
            continue;
          }

          // Fallback 2: Match by quote reference from OC observations
          if (quoteReference) {
            const quoteRef = quoteReference.replace(/\D/g, '');
            if (quoteRef) {
              const servicesByQuote = clientServices.filter(s =>
                !usedServiceIds.has(s.id) &&
                s.quoteNumber &&
                s.quoteNumber.replace(/\D/g, '') === quoteRef
              );
              
              if (servicesByQuote.length > 0) {
                for (const svc of servicesByQuote) {
                  usedServiceIds.add(svc.id);
                  matches.push({
                    parsedItem: item,
                    service: svc,
                    ocNumber,
                    fileName,
                    status: 'matched',
                  });
                }
                continue;
              }
            }
          }

          // Fallback 3: Match by glosa/description against service type name
          const glosaNorm = normalizeText(item.detail);
          if (glosaNorm) {
            const candidatesByGlosa = clientServices.filter(s =>
              !usedServiceIds.has(s.id) &&
              !s.purchaseOrder && !s.purchaseOrderNumber &&
              s.serviceType?.name &&
              (normalizeText(s.serviceType.name).includes(glosaNorm) ||
               glosaNorm.includes(normalizeText(s.serviceType.name)))
            );
            if (candidatesByGlosa.length > 0) {
              const best = item.amount > 0
                ? candidatesByGlosa.sort((a, b) => Math.abs(a.value - item.amount) - Math.abs(b.value - item.amount))[0]
                : candidatesByGlosa[0];
              usedServiceIds.add(best.id);
              matches.push({
                parsedItem: item,
                service: best,
                ocNumber,
                fileName,
                status: 'matched',
              });
              continue;
            }
          }

          // Fallback 4: Match by amount
          if (item.amount > 0) {
            const unitPrice = (item.quantity && item.quantity > 1) ? item.amount / item.quantity : null;
            const serviceByAmount = clientServices.find(s => 
              !usedServiceIds.has(s.id) && !s.purchaseOrder && !s.purchaseOrderNumber && (
                Math.abs(s.value - item.amount) < 1 ||
                (unitPrice !== null && Math.abs(s.value - unitPrice) < 1)
              )
            );
            if (serviceByAmount) {
              usedServiceIds.add(serviceByAmount.id);
              matches.push({
                parsedItem: item,
                service: serviceByAmount,
                ocNumber,
                fileName,
                status: 'matched',
              });
              continue;
            }
          }

          // No fallback match found
          matches.push({
            parsedItem: item,
            service: null,
            ocNumber,
            fileName,
            status: 'no_match',
          });
          continue;
        }

        // Find services matching this license plate (normalized comparison)
        const matchingServices = clientServices
          .filter(s => normalizePatente(s.licensePlate) === patenteNorm && !usedServiceIds.has(s.id))
          .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());

        if (matchingServices.length === 0) {
          // Fuzzy VIN matching (tolerates 1-2 OCR digit errors)
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
            matches.push({
              parsedItem: item,
              service: null,
              ocNumber,
              fileName,
              status: 'no_match',
            });
          }
        } else {
          const serviceWithoutOC = matchingServices.find(
            s => !s.purchaseOrderNumber && !s.purchaseOrder
          );

          if (serviceWithoutOC) {
            usedServiceIds.add(serviceWithoutOC.id);
            matches.push({
              parsedItem: item,
              service: serviceWithoutOC,
              ocNumber,
              fileName,
              status: 'matched',
            });
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

    setState(prev => ({ ...prev, step: 'preview', matches }));
  }, [clientId, services]);

  const applyMatches = useCallback(async (selectedMatches: MatchedService[]) => {
    const validMatches = selectedMatches.filter(m => (m.status === 'matched' || m.status === 'already_has_oc') && m.service);
    if (validMatches.length === 0) {
      toast.error('No hay servicios válidos para actualizar');
      return;
    }

    setState(prev => ({ ...prev, step: 'applying', progress: { current: 0, total: validMatches.length, fileName: '' } }));

    let successCount = 0;
    for (let i = 0; i < validMatches.length; i++) {
      const match = validMatches[i];
      try {
        const formattedOC = match.ocNumber.startsWith('OC-') 
          ? match.ocNumber 
          : `OC-${match.ocNumber}`;
        await updateService(match.service!.id, {
          purchaseOrder: formattedOC,
          status: 'with_purchase_order' as any,
        });
        successCount++;
        setState(prev => ({ ...prev, progress: { current: i + 1, total: validMatches.length, fileName: match.parsedItem.patente } }));
      } catch (err: any) {
        console.error(`Error updating service ${match.service!.folio}:`, err);
      }
    }

    setState(prev => ({ ...prev, step: 'done' }));
    toast.success(`${successCount} de ${validMatches.length} servicios actualizados con OC`);
  }, [updateService]);

  return {
    state,
    processFiles,
    applyMatches,
    reset,
  };
}
