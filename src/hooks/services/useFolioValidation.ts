
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('FolioValidation');

interface FolioValidationResult {
  isValid: boolean;
  isValidating: boolean;
  error: string | null;
  existingService?: {
    folio: string;
    clientName: string;
    createdAt: string;
  };
}

export const useFolioValidation = () => {
  const [validationResults, setValidationResults] = useState<Record<string, FolioValidationResult>>({});

  const validateFolio = useCallback(async (folio: string, excludeServiceId?: string): Promise<FolioValidationResult> => {
    if (!folio.trim()) {
      return {
        isValid: false,
        isValidating: false,
        error: 'El folio es requerido'
      };
    }

    // Marcar como validando
    setValidationResults(prev => ({
      ...prev,
      [folio]: {
        isValid: false,
        isValidating: true,
        error: null
      }
    }));

    try {
      logger.debug(`[useFolioValidation] Validating folio: ${folio}${excludeServiceId ? ` (excluding service: ${excludeServiceId})` : ''}`);
      
      let query = supabase
        .from('services')
        .select(`
          id,
          folio,
          created_at,
          clients!services_client_id_fkey(name)
        `)
        .eq('folio', folio);

      // Si estamos editando, excluir el servicio actual
      if (excludeServiceId) {
        query = query.neq('id', excludeServiceId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        logger.error('[useFolioValidation] Error validating folio:', error);
        const result = {
          isValid: false,
          isValidating: false,
          error: 'Error al validar el folio'
        };
        setValidationResults(prev => ({ ...prev, [folio]: result }));
        return result;
      }

      if (data) {
        // Folio duplicado encontrado
        const result = {
          isValid: false,
          isValidating: false,
          error: `El folio ${folio} ya existe`,
          existingService: {
            folio: data.folio,
            clientName: data.clients.name,
            createdAt: data.created_at
          }
        };
        setValidationResults(prev => ({ ...prev, [folio]: result }));
        return result;
      } else {
        // Folio único, válido
        const result = {
          isValid: true,
          isValidating: false,
          error: null
        };
        setValidationResults(prev => ({ ...prev, [folio]: result }));
        return result;
      }
    } catch (error) {
      logger.error('[useFolioValidation] Unexpected error:', error);
      const result = {
        isValid: false,
        isValidating: false,
        error: 'Error inesperado al validar el folio'
      };
      setValidationResults(prev => ({ ...prev, [folio]: result }));
      return result;
    }
  }, []);

  const getValidationResult = useCallback((folio: string): FolioValidationResult => {
    return validationResults[folio] || {
      isValid: true, // Cambiar a true por defecto para no bloquear el botón inicialmente
      isValidating: false,
      error: null
    };
  }, [validationResults]);

  const hasValidationResult = useCallback((folio: string): boolean => {
    return folio in validationResults;
  }, [validationResults]);

  const clearValidation = useCallback((folio: string) => {
    setValidationResults(prev => {
      const newState = { ...prev };
      delete newState[folio];
      return newState;
    });
  }, []);

  return {
    validateFolio,
    getValidationResult,
    hasValidationResult,
    clearValidation
  };
};
