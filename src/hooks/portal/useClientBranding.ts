import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useClientBranding');

export interface ClientBranding {
  logoUrl: string | null;
  companyName: string;
}

export const useClientBranding = () => {
  const { user } = useUser();

  return useQuery({
    queryKey: ['clientBranding', user?.client_id],
    queryFn: async (): Promise<ClientBranding> => {
      const { data, error } = await supabase
        .from('clients')
        .select('name, display_name, logo_url')
        .eq('id', user!.client_id!)
        .single();

      if (error) {
        logger.warn('Error fetching branding:', error.message);
        return { logoUrl: null, companyName: '' };
      }

      return {
        logoUrl: data.logo_url || null,
        companyName: data.display_name || data.name || '',
      };
    },
    enabled: !!user?.client_id && user.role === 'client',
    staleTime: 5 * 60 * 1000,
  });
};
