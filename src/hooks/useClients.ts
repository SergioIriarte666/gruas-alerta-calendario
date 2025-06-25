
import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Client } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const fetchClients = async (): Promise<Client[]> => {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;

  const formattedClients: Client[] = (data || []).map((client: any) => ({
    id: client.id,
    name: client.name,
    rut: client.rut,
    phone: client.phone || '',
    email: client.email || '',
    address: client.address || '',
    isActive: client.is_active ?? false,
    createdAt: client.created_at,
    updatedAt: client.updated_at
  }));

  return formattedClients;
};

export const useClients = () => {
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading: loading, refetch } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: fetchClients,
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const createClientMutation = useMutation({
    mutationFn: async (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: clientData.name,
          rut: clientData.rut,
          phone: clientData.phone,
          email: clientData.email,
          address: clientData.address,
          is_active: clientData.isActive
        })
        .select()
        .single();

      if (error) throw error;

      const newClient: Client = {
        id: data.id,
        name: data.name,
        rut: data.rut,
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        isActive: data.is_active || false,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
      return newClient;
    },
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success("Cliente creado", {
        description: `Cliente ${newClient.name} creado exitosamente.`,
      });
    },
    onError: (error: any) => {
      console.error('Error creating client:', error);
      toast.error("Error", {
        description: "No se pudo crear el cliente.",
      });
    }
  });

  const updateClientMutation = useMutation({
    mutationFn: async ({ id, clientData }: { id: string, clientData: Partial<Client> }) => {
      const updateData: any = {};
      
      if (clientData.name !== undefined) updateData.name = clientData.name;
      if (clientData.rut !== undefined) updateData.rut = clientData.rut;
      if (clientData.phone !== undefined) updateData.phone = clientData.phone;
      if (clientData.email !== undefined) updateData.email = clientData.email;
      if (clientData.address !== undefined) updateData.address = clientData.address;
      if (clientData.isActive !== undefined) updateData.is_active = clientData.isActive;

      const { error } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      return { id, ...clientData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success("Cliente actualizado", {
        description: "El cliente ha sido actualizado exitosamente.",
      });
    },
    onError: (error: any) => {
      console.error('Error updating client:', error);
      toast.error("Error", {
        description: "No se pudo actualizar el cliente.",
      });
    }
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success("Cliente eliminado", {
        description: "El cliente ha sido eliminado exitosamente.",
      });
    },
    onError: (error: any) => {
      console.error('Error deleting client:', error);
      toast.error("Error", {
        description: "No se pudo eliminar el cliente.",
      });
    }
  });

  const toggleClientStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const client = clients.find(c => c.id === id);
      if (!client) throw new Error('Client not found');
      
      const { error } = await supabase
        .from('clients')
        .update({ is_active: !client.isActive })
        .eq('id', id);

      if (error) throw error;
      return client;
    },
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.info("Estado actualizado", {
        description: `Cliente ${client.isActive ? 'desactivado' : 'activado'} exitosamente.`,
      });
    },
    onError: (error: any) => {
      console.error('Error toggling client status:', error);
      toast.error("Error", {
        description: "No se pudo cambiar el estado del cliente.",
      });
    }
  });

  return {
    clients,
    loading,
    createClient: createClientMutation.mutateAsync,
    updateClient: (id: string, clientData: Partial<Client>) => updateClientMutation.mutateAsync({ id, clientData }),
    deleteClient: deleteClientMutation.mutateAsync,
    toggleClientStatus: toggleClientStatusMutation.mutateAsync,
    refetch,
  };
};
