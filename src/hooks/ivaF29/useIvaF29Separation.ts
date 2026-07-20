import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('IvaF29');

interface ToggleArgs {
  invoiceId: string;
  /** Estado deseado: true = marcar IVA apartado, false = quitar la marca. */
  separated: boolean;
}

/**
 * Marca/desmarca una factura como "IVA apartado para el F29".
 * Persiste en iva_f29_separations (una fila por factura apartada).
 */
export function useIvaF29Separation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, separated }: ToggleArgs) => {
      if (separated) {
        const { data: auth } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('iva_f29_separations')
          .upsert(
            { invoice_id: invoiceId, separated_by: auth.user?.id ?? null },
            { onConflict: 'invoice_id' },
          );
        if (error) {
          logger.error('Error marcando IVA apartado', error);
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('iva_f29_separations')
          .delete()
          .eq('invoice_id', invoiceId);
        if (error) {
          logger.error('Error quitando marca de IVA apartado', error);
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iva-f29'] });
    },
  });
}
