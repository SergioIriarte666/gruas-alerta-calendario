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
  status: 'matched' | 'no_match' | 'already_has_oc';
}

interface ImportState {
  step: 'idle' | 'uploading' | 'matching' | 'preview' | 'applying' | 'done';
  parsedOCs: ParsedOC[];
  matches: MatchedService[];
  progress: { current: number; total: number; fileName: string };
  error: string | null;
}

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

    // Now match against existing services
    setState(prev => ({ ...prev, step: 'matching', parsedOCs }));

    const clientServices = services.filter(s => s.client?.id === clientId);
    const matches: MatchedService[] = [];

    for (const oc of parsedOCs) {
      for (const item of oc.items) {
        const patente = item.patente.toUpperCase();

        // Find services matching this license plate
        const matchingServices = clientServices
          .filter(s => s.licensePlate?.toUpperCase() === patente)
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
            matches.push({
              parsedItem: item,
              service: serviceWithoutOC,
              ocNumber: oc.ocNumber,
              fileName: oc.fileName,
              status: 'matched',
            });
          } else {
            matches.push({
              parsedItem: item,
              service: matchingServices[0],
              ocNumber: oc.ocNumber,
              fileName: oc.fileName,
              status: 'already_has_oc',
            });
          }
        }
      }
    }

    setState(prev => ({ ...prev, step: 'preview', matches }));
  }, [clientId, services]);

  const applyMatches = useCallback(async (selectedMatches: MatchedService[]) => {
    const validMatches = selectedMatches.filter(m => m.status === 'matched' && m.service);
    if (validMatches.length === 0) {
      toast.error('No hay servicios válidos para actualizar');
      return;
    }

    setState(prev => ({ ...prev, step: 'applying', progress: { current: 0, total: validMatches.length, fileName: '' } }));

    let successCount = 0;
    for (let i = 0; i < validMatches.length; i++) {
      const match = validMatches[i];
      try {
        await updateService(match.service!.id, {
          purchaseOrder: match.ocNumber,
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
