import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServices } from '@/hooks/useServices';
import { toast } from 'sonner';

export interface ParsedOCItem {
  patente: string;
  detail: string;
  amount: number;
}

export interface ParsedOC {
  ocNumber: string;
  date: string | null;
  items: ParsedOCItem[];
  totals: { neto: number; iva: number; total: number };
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
const normalizeText = (t: string | null | undefined) =>
  (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

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

    // Now match against existing services - fetch fresh data from DB
    setState(prev => ({ ...prev, step: 'matching', parsedOCs }));

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
      s.status === 'completed' || s.status === 'with_purchase_order'
    );

    const matches: MatchedService[] = [];
    const usedServiceIds = new Set<string>();

    for (const oc of parsedOCs) {
      for (const item of oc.items) {
        const patenteNorm = normalizePatente(item.patente);

        // If patente is empty, use fallback matching by OC number or amount
        if (!patenteNorm) {
          const ocNorm = normalizeOC(oc.ocNumber);
          
          // Fallback 1: Find services with the same OC already assigned
          const serviceWithSameOC = clientServices.find(s => 
            !usedServiceIds.has(s.id) && (normalizeOC(s.purchaseOrder) === ocNorm || normalizeOC(s.purchaseOrderNumber) === ocNorm)
          );
          
          if (serviceWithSameOC) {
            usedServiceIds.add(serviceWithSameOC.id);
            matches.push({
              parsedItem: item,
              service: serviceWithSameOC,
              ocNumber: oc.ocNumber,
              fileName: oc.fileName,
              status: 'same_oc',
            });
            continue;
          }

          // Fallback 2: Match by glosa/description against service type name
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
              // Prefer the one with closest amount match
              const best = item.amount > 0
                ? candidatesByGlosa.sort((a, b) => Math.abs(a.value - item.amount) - Math.abs(b.value - item.amount))[0]
                : candidatesByGlosa[0];
              usedServiceIds.add(best.id);
              matches.push({
                parsedItem: item,
                service: best,
                ocNumber: oc.ocNumber,
                fileName: oc.fileName,
                status: 'matched',
              });
              continue;
            }
          }

          // Fallback 3: Match by amount only
          if (item.amount > 0) {
            const serviceByAmount = clientServices.find(s => 
              !usedServiceIds.has(s.id) && !s.purchaseOrder && !s.purchaseOrderNumber && Math.abs(s.value - item.amount) < 1
            );
            if (serviceByAmount) {
              usedServiceIds.add(serviceByAmount.id);
              matches.push({
                parsedItem: item,
                service: serviceByAmount,
                ocNumber: oc.ocNumber,
                fileName: oc.fileName,
                status: 'matched',
              });
              continue;
            }
          }

          // No fallback match found
          matches.push({
            parsedItem: item,
            service: null,
            ocNumber: oc.ocNumber,
            fileName: oc.fileName,
            status: 'no_match',
          });
          continue;
        }

        // Find services matching this license plate (normalized comparison)
        const matchingServices = clientServices
          .filter(s => normalizePatente(s.licensePlate) === patenteNorm && !usedServiceIds.has(s.id))
          .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());

        if (matchingServices.length === 0) {
          matches.push({
            parsedItem: item,
            service: null,
            ocNumber: oc.ocNumber,
            fileName: oc.fileName,
            status: 'no_match',
          });
        } else {
          // Find the most recent service without an OC
          const serviceWithoutOC = matchingServices.find(
            s => !s.purchaseOrderNumber && !s.purchaseOrder
          );

          if (serviceWithoutOC) {
            usedServiceIds.add(serviceWithoutOC.id);
            matches.push({
              parsedItem: item,
              service: serviceWithoutOC,
              ocNumber: oc.ocNumber,
              fileName: oc.fileName,
              status: 'matched',
            });
          } else {
            // Check if the most recent service already has the same OC
            const topService = matchingServices[0];
            const hasSameOC = normalizeOC(topService.purchaseOrder) === normalizeOC(oc.ocNumber) || normalizeOC(topService.purchaseOrderNumber) === normalizeOC(oc.ocNumber);
            usedServiceIds.add(topService.id);
            matches.push({
              parsedItem: item,
              service: topService,
              ocNumber: oc.ocNumber,
              fileName: oc.fileName,
              status: hasSameOC ? 'same_oc' : 'already_has_oc',
            });
          }
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
