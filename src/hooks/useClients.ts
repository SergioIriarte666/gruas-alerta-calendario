import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Client } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { 
  offlineCreate, 
  offlineUpdate, 
  offlineDelete, 
  offlineFetch,
  generateTempId,
  markAsOffline 
} from '@/services/offlineOperations';

// Transformaciones DB <-> App
const transformFromDb = (client: any): Client => ({
  id: client.id,
  name: client.name,
  rut: client.rut,
  phone: client.phone || '',
  email: client.email || '',
  address: client.address || '',
  department: client.department || '',
  contactName: client.contact_name || '',
  isActive: client.is_active ?? false,
  createdAt: client.created_at,
  updatedAt: client.updated_at,
  createdBy: client.created_by,
  creatorName: client.creator?.full_name || client.creator?.email || undefined,
  _isOffline: client._isOffline || false
});

const transformToDb = (client: Partial<Client>) => {
  const data: any = {};
  if (client.name !== undefined) data.name = client.name;
  if (client.rut !== undefined) data.rut = client.rut;
  if (client.phone !== undefined) data.phone = client.phone;
  if (client.email !== undefined) data.email = client.email;
  if (client.address !== undefined) data.address = client.address;
  if (client.department !== undefined) data.department = client.department;
  if (client.contactName !== undefined) data.contact_name = client.contactName;
  if (client.isActive !== undefined) data.is_active = client.isActive;
  if (client.defaultPaymentTermId !== undefined) data.default_payment_term_id = client.defaultPaymentTermId;
  return data;
};

const fetchClients = async (): Promise<Client[]> => {
  const { data, error } = await supabase
    .from('clients')
    .select(`
      *,
      creator:profiles!clients_created_by_fkey (
        id,
        full_name,
        email
      )
    `)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []).map(transformFromDb);
};

export const useClients = () => {
  const queryClient = useQueryClient();
  const { effectiveIsOnline } = useOfflineMode();

  const { data: clients = [], isLoading: loading, refetch } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, isFromCache } = await offlineFetch<Client>(
        'clients',
        effectiveIsOnline,
        fetchClients,
        (rawData) => rawData.map(transformFromDb)
      );
      
      if (isFromCache && data.length > 0) {
        toast.info('Datos desde cache local', { 
          description: `${data.length} clientes cargados offline`,
          duration: 2000
        });
      }
      
      return data;
    },
    retry: effectiveIsOnline ? 2 : 0,
    staleTime: 5 * 60 * 1000,
  });

  const createClientMutation = useMutation({
    mutationFn: async (clientData: (Omit<Client, 'id' | 'createdAt' | 'updatedAt'> & { departments?: string[] })) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const departments = clientData.departments;
      
      if (departments && departments.length > 1 && effectiveIsOnline) {
        // Múltiples departamentos solo funciona online
        const clientsToCreate = departments.map(department => ({
          name: clientData.name,
          rut: clientData.rut,
          phone: clientData.phone,
          email: clientData.email,
          address: clientData.address,
          department: department,
          contact_name: clientData.contactName,
          is_active: clientData.isActive,
          created_by: user?.id || null
        }));

        const { data, error } = await supabase
          .from('clients')
          .insert(clientsToCreate)
          .select();

        if (error) throw error;

        return {
          clients: (data || []).map(transformFromDb),
          count: data?.length || 0
        };
      } else {
        // Crear un solo cliente (funciona offline)
        const department = departments && departments.length > 0 ? departments[0] : clientData.department;
        
        const dbData = {
          name: clientData.name,
          rut: clientData.rut,
          phone: clientData.phone,
          email: clientData.email,
          address: clientData.address,
          department: department,
          contact_name: clientData.contactName,
          is_active: clientData.isActive,
          created_by: user?.id || null
        };

        const result = await offlineCreate<Client>(
          'clients',
          dbData as any,
          effectiveIsOnline,
          undefined,
          transformFromDb
        );

        if (result.error) throw result.error;
        
        return {
          clients: result.data ? [result.data] : [],
          count: 1,
          isOffline: result.isOffline
        };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      
      if (result.count > 1) {
        toast.success("Clientes creados", {
          description: `Se crearon ${result.count} registros de cliente con diferentes departamentos.`,
        });
      } else {
        toast.success("Cliente creado", {
          description: `Cliente ${result.clients[0]?.name} creado exitosamente.`,
        });
      }
    },
    onError: (error: any) => {
      console.error('Error creating client:', error);
      
      if (error?.code === '23505' || error?.message?.includes('duplicate key value')) {
        if (error?.message?.includes('rut_department')) {
          toast.error("Cliente duplicado", {
            description: `Ya existe un cliente registrado con este RUT en uno de los departamentos especificados.`,
          });
          return;
        }
      }
      
      toast.error("Error", {
        description: "No se pudo crear el cliente.",
      });
    }
  });

  const updateClientMutation = useMutation({
    mutationFn: async ({ id, clientData }: { id: string, clientData: Partial<Client> }) => {
      const result = await offlineUpdate<Client>(
        'clients',
        id,
        clientData,
        effectiveIsOnline,
        transformToDb,
        transformFromDb
      );

      if (result.error) throw result.error;
      return result;
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
      const result = await offlineDelete('clients', id, effectiveIsOnline);
      if (result.error) throw result.error;
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
      
      const result = await offlineUpdate<Client>(
        'clients',
        id,
        { isActive: !client.isActive },
        effectiveIsOnline,
        transformToDb,
        transformFromDb
      );

      if (result.error) throw result.error;
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
