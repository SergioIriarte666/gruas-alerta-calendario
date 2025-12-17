import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ServiceRate } from '@/types/serviceRates';

interface LookupParams {
  clientId: string;
  origin: string;
  serviceTypeId?: string | null;
}

export const useServiceRateLookup = () => {
  const [matchedRate, setMatchedRate] = useState<ServiceRate | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const lookupRate = useCallback(async ({ clientId, origin, serviceTypeId }: LookupParams) => {
    if (!clientId || !origin || origin.trim() === '') {
      setMatchedRate(null);
      return null;
    }

    setIsLookingUp(true);
    try {
      // 1. First try exact match: client + origin + service type
      if (serviceTypeId) {
        const { data: exactMatch, error: exactError } = await supabase
          .from('service_rates')
          .select('*')
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

      // 2. Try generic rate: client + origin + NO service type (null)
      const { data: genericMatch, error: genericError } = await supabase
        .from('service_rates')
        .select('*')
        .eq('client_id', clientId)
        .is('service_type_id', null)
        .ilike('origin', origin.trim())
        .eq('is_active', true)
        .maybeSingle();

      if (!genericError && genericMatch) {
        setMatchedRate(genericMatch);
        return genericMatch;
      }

      // 3. Fallback: any rate matching client + origin (ignore service type)
      const { data: anyMatch, error: anyError } = await supabase
        .from('service_rates')
        .select('*')
        .eq('client_id', clientId)
        .ilike('origin', origin.trim())
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!anyError && anyMatch) {
        setMatchedRate(anyMatch);
        return anyMatch;
      }

      // 4. Final fallback: client-only rate (no origin required)
      const { data: clientOnlyMatch, error: clientOnlyError } = await supabase
        .from('service_rates')
        .select('*')
        .eq('client_id', clientId)
        .is('origin', null)
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
      console.error('Error looking up service rate:', error);
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
