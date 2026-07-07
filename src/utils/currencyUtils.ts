import { formatCurrency } from '@/lib/utils';
import { createLogger } from "@/lib/logger";
import { supabase } from '@/integrations/supabase/client';


const logger = createLogger("currencyUtils");
// Cache para configuraciones del usuario
let userCurrencyCache: {
  currency: string;
  lastUpdate: number;
} | null = null;

const CACHE_DURATION = 30000; // 30 segundos

// Función para obtener la moneda del usuario con cache
const getUserCurrencyFromCache = async (): Promise<string> => {
  const now = Date.now();
  
  if (userCurrencyCache && (now - userCurrencyCache.lastUpdate) < CACHE_DURATION) {
    return userCurrencyCache.currency;
  }

  try {
    if (typeof window !== 'undefined') {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data } = await supabase
          .from('user_settings')
          .select('currency')
          .eq('user_id', user.id)
          .single();

        const currency = data?.currency || 'CLP';
        userCurrencyCache = {
          currency,
          lastUpdate: now
        };
        return currency;
      }
    }
    
    userCurrencyCache = {
      currency: 'CLP',
      lastUpdate: now
    };
    return 'CLP';
  } catch (error) {
    logger.warn('Error fetching user currency, using CLP:', error);
    userCurrencyCache = {
      currency: 'CLP',
      lastUpdate: now
    };
    return 'CLP';
  }
};

// Versión sincrónica para compatibilidad
export const getUserCurrencySync = (): string => {
  return userCurrencyCache?.currency || 'CLP';
};

// Función para invalidar cache cuando las configuraciones cambien
export const invalidateUserCurrencyCache = () => {
  userCurrencyCache = null;
};

// Formatear moneda usando las configuraciones del usuario
export const formatUserCurrency = (amount: number): string => {
  const currency = getUserCurrencySync();
  return formatCurrency(amount, currency);
};

// Versión asíncrona que obtiene la moneda del usuario
export const formatUserCurrencyAsync = async (amount: number): Promise<string> => {
  const currency = await getUserCurrencyFromCache();
  return formatCurrency(amount, currency);
};
