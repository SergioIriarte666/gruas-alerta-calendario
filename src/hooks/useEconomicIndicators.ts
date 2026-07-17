import { useQuery } from '@tanstack/react-query';
import { createLogger } from '@/lib/logger';
import { EconomicIndicators, FindicSummary } from '@/types/economicIndicators';

const logger = createLogger('EconomicIndicators');

const FINDIC_API_URL = 'https://findic.cl/api/';

const fetchEconomicIndicators = async (): Promise<EconomicIndicators | undefined> => {
  try {
    const response = await fetch(FINDIC_API_URL);

    if (!response.ok) {
      logger.warn(`findic.cl respondió con estado ${response.status}`);
      return undefined;
    }

    const data: FindicSummary = await response.json();
    const { uf, dolar, utm, euro, libra_cobre, fecha } = data;

    return { uf, dolar, utm, euro, libra_cobre, fecha };
  } catch (error) {
    logger.warn('No se pudieron obtener los indicadores económicos', error);
    return undefined;
  }
};

export const useEconomicIndicators = () => {
  return useQuery({
    queryKey: ['economic-indicators'],
    queryFn: fetchEconomicIndicators,
    staleTime: 60 * 60 * 1000, // 1 hora — se actualizan una vez al día
    gcTime: 2 * 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
};
