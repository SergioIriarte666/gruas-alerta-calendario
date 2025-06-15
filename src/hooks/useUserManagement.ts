
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'operator' | 'viewer';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useUserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_all_users');
      
      if (error) throw error;
      
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'operator' | 'viewer') => {
    try {
      setUpdating(userId);
      const { data, error } = await supabase.rpc('update_user_role', {
        user_id: userId,
        new_role: newRole
      });

      if (error) throw error;

      toast.success('Rol actualizado correctamente');
      await fetchUsers(); // Recargar la lista
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Error al actualizar el rol del usuario');
    } finally {
      setUpdating(null);
    }
  };

  const toggleUserStatus = async (userId: string, newStatus: boolean) => {
    try {
      setUpdating(userId);
      const { data, error } = await supabase.rpc('toggle_user_status', {
        user_id: userId,
        new_status: newStatus
      });

      if (error) throw error;

      toast.success(`Usuario ${newStatus ? 'activado' : 'desactivado'} correctamente`);
      await fetchUsers(); // Recargar la lista
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Error al cambiar el estado del usuario');
    } finally {
      setUpdating(null);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    updating,
    updateUserRole,
    toggleUserStatus,
    refetchUsers: fetchUsers
  };
};
