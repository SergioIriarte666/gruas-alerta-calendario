import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";

const logger = createLogger('ClientBillingContacts');

export interface BillingContactInput {
  name: string;
  email: string;
  phone?: string;
  position?: string;
}

export const useClientBillingContacts = (clientId?: string) => {
  const queryClient = useQueryClient();
  const queryKey = ['client-billing-contacts', clientId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_billing_contacts')
        .select('*')
        .eq('client_id', clientId!)
        .order('is_active', { ascending: false })
        .order('name', { ascending: true });

      if (error) {
        logger.error('Error fetching billing contacts:', error);
        throw error;
      }
      return data ?? [];
    },
    enabled: !!clientId,
  });

  const createContact = useMutation({
    mutationFn: async (input: BillingContactInput) => {
      const normalizedEmail = input.email.toLowerCase().trim();
      const { data, error } = await supabase
        .from('client_billing_contacts')
        .insert({
          client_id: clientId!,
          name: input.name,
          email: normalizedEmail,
          phone: input.phone || null,
          position: input.position || null,
        })
        .select()
        .single();

      if (error) {
        if ((error as any).code === '23505') {
          throw new Error('DUPLICATE_EMAIL');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Contacto agregado', {
        description: 'El contacto de cobranza se ha creado exitosamente.',
      });
    },
    onError: (error: any) => {
      logger.error('Error creating billing contact:', error);
      if (error.message === 'DUPLICATE_EMAIL') {
        toast.error('Email duplicado', {
          description: 'Ya existe un contacto con ese email para este cliente.',
        });
      } else {
        toast.error('Error al crear contacto', {
          description: 'No se pudo crear el contacto de cobranza.',
        });
      }
    },
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & BillingContactInput) => {
      const normalizedEmail = input.email.toLowerCase().trim();
      const { data, error } = await supabase
        .from('client_billing_contacts')
        .update({
          name: input.name,
          email: normalizedEmail,
          phone: input.phone || null,
          position: input.position || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if ((error as any).code === '23505') {
          throw new Error('DUPLICATE_EMAIL');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Contacto actualizado', {
        description: 'El contacto de cobranza se ha actualizado exitosamente.',
      });
    },
    onError: (error: any) => {
      logger.error('Error updating billing contact:', error);
      if (error.message === 'DUPLICATE_EMAIL') {
        toast.error('Email duplicado', {
          description: 'Ya existe otro contacto con ese email para este cliente.',
        });
      } else {
        toast.error('Error al actualizar contacto', {
          description: 'No se pudo actualizar el contacto de cobranza.',
        });
      }
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('client_billing_contacts')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(variables.is_active ? 'Contacto activado' : 'Contacto desactivado', {
        description: `El contacto ha sido ${variables.is_active ? 'activado' : 'desactivado'}.`,
      });
    },
    onError: (error: any) => {
      logger.error('Error toggling billing contact:', error);
      toast.error('Error al cambiar estado', {
        description: 'No se pudo cambiar el estado del contacto.',
      });
    },
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('client_billing_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Contacto eliminado', {
        description: 'El contacto de cobranza ha sido eliminado.',
      });
    },
    onError: (error: any) => {
      logger.error('Error deleting billing contact:', error);
      toast.error('Error al eliminar contacto', {
        description: 'No se pudo eliminar el contacto de cobranza.',
      });
    },
  });

  return {
    contacts: query.data ?? [],
    isLoading: query.isLoading,
    createContact,
    updateContact,
    toggleActive,
    deleteContact,
  };
};
