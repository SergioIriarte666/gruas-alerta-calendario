
import { useState, useEffect } from 'react';
import { Client } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useClients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedClients: Client[] = data.map(client => ({
        id: client.id,
        name: client.name,
        rut: client.rut,
        phone: client.phone || '',
        email: client.email || '',
        address: client.address || '',
        isActive: client.is_active || false,
        createdAt: client.created_at,
        updatedAt: client.updated_at
      }));

      setClients(formattedClients);
    } catch (error: any) {
      console.error('Error fetching clients:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los clientes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const createClient = async (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
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

      setClients(prev => [newClient, ...prev]);
      
      toast({
        title: "Cliente creado",
        description: `Cliente ${clientData.name} creado exitosamente.`,
      });

      return newClient;
    } catch (error: any) {
      console.error('Error creating client:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el cliente.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateClient = async (id: string, clientData: Partial<Client>) => {
    try {
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

      setClients(prev => prev.map(client => 
        client.id === id 
          ? { ...client, ...clientData, updatedAt: new Date().toISOString() }
          : client
      ));

      toast({
        title: "Cliente actualizado",
        description: "El cliente ha sido actualizado exitosamente.",
      });
    } catch (error: any) {
      console.error('Error updating client:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el cliente.",
        variant: "destructive",
      });
    }
  };

  const deleteClient = async (id: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setClients(prev => prev.filter(client => client.id !== id));
      
      toast({
        title: "Cliente eliminado",
        description: "El cliente ha sido eliminado exitosamente.",
      });
    } catch (error: any) {
      console.error('Error deleting client:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el cliente.",
        variant: "destructive",
      });
    }
  };

  const toggleClientStatus = async (id: string) => {
    try {
      const client = clients.find(c => c.id === id);
      if (!client) return;

      const { error } = await supabase
        .from('clients')
        .update({ is_active: !client.isActive })
        .eq('id', id);

      if (error) throw error;

      setClients(prev => prev.map(client => 
        client.id === id 
          ? { ...client, isActive: !client.isActive, updatedAt: new Date().toISOString() }
          : client
      ));

      toast({
        title: "Estado actualizado",
        description: `Cliente ${client.isActive ? 'desactivado' : 'activado'} exitosamente.`,
      });
    } catch (error: any) {
      console.error('Error toggling client status:', error);
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado del cliente.",
        variant: "destructive",
      });
    }
  };

  return {
    clients,
    loading,
    createClient,
    updateClient,
    deleteClient,
    toggleClientStatus,
    refetch: fetchClients
  };
};
