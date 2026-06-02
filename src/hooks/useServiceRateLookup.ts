import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ServiceRate } from '@/types/serviceRates';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useServiceRateLookup");
const SERVICE_RATE_SELECT = `
  id,
  client_id,
  service_type_id,
  origin,
  destination,
  value,
  notes,
  is_active,
  created_at,
  created_by,
  updated_at
`;

interface LookupParams {
  clientId: string;
  origin: string;
  serviceTypeId?: string | null;
}

export const useServiceRateLookup = () => {
  const [matchedRate, setMatchedRate] = useState<ServiceRate | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const lookupRate = useCallback(async ({ clientId, origin, serviceTypeId }: LookupParams) => {
    if (!clientId) {
      setMatchedRate(null);
      return null;
    }

    const hasOrigin = origin && origin.trim() !== '';

    setIsLookingUp(true);
    try {
      // Si hay origen, buscar tarifas específicas por origen primero
      if (hasOrigin) {
        // 1. Exact match: client + origin + service type
        if (serviceTypeId) {
          const { data: exactMatch, error: exactError } = await supabase
            .from('service_rates')
            .select(SERVICE_RATE_SELECT)
            .eq('client_id', clientId)
            .eq('service_type_id', serviceTypeId)
            .ilike('origin', origin.trim())
            .eq('is_active', true)
            .maybeSingle();

          if (!exactError && exactMatch) {
            setMatchedRate(exactMatch);
            return exactMatch;
          }
        }

        // 2. Generic rate: client + origin + NO service type
        const { data: genericMatch, error: genericError } = await supabase
          .from('service_rates')
          .select(SERVICE_RATE_SELECT)
          .eq('client_id', clientId)
          .is('service_type_id', null)
          .ilike('origin', origin.trim())
          .eq('is_active', true)
          .maybeSingle();

        if (!genericError && genericMatch) {
          setMatchedRate(genericMatch);
          return genericMatch;
        }

        // 3. Any rate: client + origin (ignore service type)
        const { data: anyMatch, error: anyError } = await supabase
          .from('service_rates')
          .select(SERVICE_RATE_SELECT)
          .eq('client_id', clientId)
          .ilike('origin', origin.trim())
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (!anyError && anyMatch) {
          setMatchedRate(anyMatch);
          return anyMatch;
        }
      }

      // 4. Client + service type + no origin (tarifa genérica por tipo)
      if (serviceTypeId) {
        const { data: typeMatch, error: typeError } = await supabase
          .from('service_rates')
          .select(SERVICE_RATE_SELECT)
          .eq('client_id', clientId)
          .eq('service_type_id', serviceTypeId)
          .is('origin', null)
          .eq('is_active', true)
          .maybeSingle();

        if (!typeError && typeMatch) {
          setMatchedRate(typeMatch);
          return typeMatch;
        }
      }

      // 5. Final fallback: client-only rate (no origin, no service type)
      const { data: clientOnlyMatch, error: clientOnlyError } = await supabase
        .from('service_rates')
        .select(SERVICE_RATE_SELECT)
        .eq('client_id', clientId)
        .is('origin', null)
        .is('service_type_id', null)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!clientOnlyError && clientOnlyMatch) {
        setMatchedRate(clientOnlyMatch);
        return clientOnlyMatch;
      }

      // No match found
      setMatchedRate(null);
      return null;
    } catch (error) {
      logger.error('Error looking up service rate:', error);
      setMatchedRate(null);
      return null;
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  const clearMatchedRate = useCallback(() => {
    setMatchedRate(null);
  }, []);

  return {
    matchedRate,
    isLookingUp,
    lookupRate,
    clearMatchedRate,
  };
};
