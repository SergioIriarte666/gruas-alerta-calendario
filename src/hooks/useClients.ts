
import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Client } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

  const formattedClients: Client[] = (data || []).map((client: any) => ({
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
    // Nuevos campos de facturación diferida
    billingCycleType: client.billing_cycle_type || 'immediate',
    billingDelayDays: client.billing_delay_days || 0,
    billingCycleDay: client.billing_cycle_day || undefined,
    autoInvoiceGeneration: client.auto_invoice_generation || false,
    billingNotes: client.billing_notes || ''
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
    mutationFn: async (clientData: (Omit<Client, 'id' | 'createdAt' | 'updatedAt'> & { departments?: string[] })) => {
      const departments = clientData.departments;
      
      if (departments && departments.length > 1) {
        // Crear múltiples registros para diferentes departamentos
        const clientsToCreate = departments.map(department => ({
          name: clientData.name,
          rut: clientData.rut,
          phone: clientData.phone,
          email: clientData.email,
          address: clientData.address,
          department: department,
          contact_name: clientData.contactName,
          is_active: clientData.isActive
        }));

        const { data, error } = await supabase
          .from('clients')
          .insert(clientsToCreate)
          .select();

        if (error) throw error;

        return {
          clients: data || [],
          count: data?.length || 0
        };
      } else {
        // Crear un solo cliente (modo normal o edición)
        const department = departments && departments.length > 0 ? departments[0] : clientData.department;
        
        const { data, error } = await supabase
          .from('clients')
          .insert({
            name: clientData.name,
            rut: clientData.rut,
            phone: clientData.phone,
            email: clientData.email,
            address: clientData.address,
            department: department,
            contact_name: clientData.contactName,
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
          department: data.department || '',
          contactName: data.contact_name || '',
          isActive: data.is_active || false,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };
        
        return {
          clients: [newClient],
          count: 1
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
      
      // Check for duplicate errors
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
      const updateData: any = {};
      
      if (clientData.name !== undefined) updateData.name = clientData.name;
      if (clientData.rut !== undefined) updateData.rut = clientData.rut;
      if (clientData.phone !== undefined) updateData.phone = clientData.phone;
      if (clientData.email !== undefined) updateData.email = clientData.email;
      if (clientData.address !== undefined) updateData.address = clientData.address;
      if (clientData.department !== undefined) updateData.department = clientData.department;
      if (clientData.contactName !== undefined) updateData.contact_name = clientData.contactName;
      if (clientData.isActive !== undefined) updateData.is_active = clientData.isActive;
      if (clientData.defaultPaymentTermId !== undefined) updateData.default_payment_term_id = clientData.defaultPaymentTermId;

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
