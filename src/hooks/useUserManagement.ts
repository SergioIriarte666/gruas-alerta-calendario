
import { useState, useEffect } from 'react';
import { enhancedSupabase } from '@/integrations/supabase/enhancedClient';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'operator' | 'viewer' | 'client';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  client_id: string | null;
  client_name: string | null;
}

interface Client {
  id: string;
  name: string;
  rut: string;
  email: string | null;
}

interface CreateUserData {
  email: string;
  full_name: string;
  role: 'admin' | 'operator' | 'viewer' | 'client';
  client_id?: string | null;
}

export const useUserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const supabase = enhancedSupabase.getClient();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const result = await enhancedSupabase.query(
        async () => {
          return await (supabase as any).rpc('get_all_users');
        },
        'fetch users'
      );
      
      if (result.error) throw result.error;
      
      setUsers(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const result = await enhancedSupabase.query(
        async () => {
          return await supabase
            .from('clients')
            .select('id, name, rut, email')
            .eq('is_active', true)
            .order('name');
        },
        'fetch clients'
      );
      
      if (result.error) throw result.error;
      
      setClients(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const createUser = async (userData: CreateUserData) => {
    try {
      setCreating(true);
      const result = await enhancedSupabase.query(
        async () => {
          return await (supabase as any).rpc('admin_create_user', {
            p_email: userData.email,
            p_full_name: userData.full_name,
            p_role: userData.role,
            p_client_id: userData.client_id || null
          });
        },
        'create user'
      );

      if (result.error) throw result.error;

      toast.success('Usuario creado correctamente');
      await fetchUsers();
      return { success: true };
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Error al crear el usuario');
      return { success: false, error: error.message };
    } finally {
      setCreating(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'operator' | 'viewer' | 'client') => {
    try {
      setUpdating(userId);
      const result = await enhancedSupabase.query(
        async () => {
          return await (supabase as any).rpc('update_user_role', {
            user_id: userId,
            new_role: newRole
          });
        },
        'update user role'
      );

      if (result.error) throw result.error;

      toast.success('Rol actualizado correctamente');
      await fetchUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Error al actualizar el rol del usuario');
    } finally {
      setUpdating(null);
    }
  };

  const assignClientToUser = async (userId: string, clientId: string | null) => {
    try {
      setUpdating(userId);
      const result = await enhancedSupabase.query(
        async () => {
          return await supabase
            .from('profiles')
            .update({ client_id: clientId, updated_at: new Date().toISOString() })
            .eq('id', userId);
        },
        'assign client to user'
      );

      if (result.error) throw result.error;

      toast.success('Cliente asignado correctamente');
      await fetchUsers();
    } catch (error) {
      console.error('Error assigning client to user:', error);
      toast.error('Error al asignar cliente al usuario');
    } finally {
      setUpdating(null);
    }
  };

  const toggleUserStatus = async (userId: string, newStatus: boolean) => {
    try {
      setUpdating(userId);
      const result = await enhancedSupabase.query(
        async () => {
          return await (supabase as any).rpc('toggle_user_status', {
            user_id: userId,
            new_status: newStatus
          });
        },
        'toggle user status'
      );

      if (result.error) throw result.error;

      toast.success(`Usuario ${newStatus ? 'activado' : 'desactivado'} correctamente`);
      await fetchUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Error al cambiar el estado del usuario');
    } finally {
      setUpdating(null);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchClients();
  }, []);

  return {
    users,
    clients,
    loading,
    updating,
    creating,
    createUser,
    updateUserRole,
    assignClientToUser,
    toggleUserStatus,
    refetchUsers: fetchUsers
  };
};
