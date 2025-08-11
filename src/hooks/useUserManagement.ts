import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

interface UserInvitation {
  id: string;
  user_id: string;
  email: string;
  status: 'pending' | 'sent' | 'accepted' | 'expired';
  sent_at: string | null;
  accepted_at: string | null;
  created_at: string;
}

export const useUserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [sendingInvitation, setSendingInvitation] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any).rpc('get_all_users');
      
      if (error) throw error;
      
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Transform the data to ensure proper typing
      const typedInvitations: UserInvitation[] = (Array.isArray(data) ? data : []).map((invitation: any) => ({
        id: invitation.id,
        user_id: invitation.user_id,
        email: invitation.email,
        status: invitation.status as 'pending' | 'sent' | 'accepted' | 'expired',
        sent_at: invitation.sent_at,
        accepted_at: invitation.accepted_at,
        created_at: invitation.created_at,
      }));
      
      setInvitations(typedInvitations);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, rut, email')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      
      setClients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const createUser = async (userData: CreateUserData) => {
    try {
      setCreating(true);
      console.log('Creating user with data:', userData);
      
      // Crear el usuario
      const { data, error } = await (supabase as any).rpc('admin_create_user', {
        p_email: userData.email,
        p_full_name: userData.full_name,
        p_role: userData.role,
        p_client_id: userData.client_id || null
      });

      if (error) throw error;

      const newUserId = data;
      console.log('User created successfully with ID:', newUserId);

      // Enviar invitación por email
      try {
        const clientName = userData.client_id ? 
          clients.find(c => c.id === userData.client_id)?.name : undefined;

        console.log('📧 Enviando invitación por email para usuario:', {
          userId: newUserId,
          email: userData.email,
          fullName: userData.full_name,
          role: userData.role,
          clientName
        });

        const { data: invitationData, error: invitationError } = await supabase.functions.invoke('send-user-invitation', {
          body: {
            userId: newUserId,
            email: userData.email,
            fullName: userData.full_name,
            role: userData.role,
            clientName
          }
        });

        console.log('Invitation result:', { data: invitationData, error: invitationError });

        if (invitationError) {
          console.error('Error sending invitation:', invitationError);
          toast.warning('Usuario creado, pero hubo un problema enviando la invitación por email');
        } else if (invitationData?.error) {
          console.error('Error in invitation function:', invitationData.error);
          toast.warning('Usuario creado, pero hubo un problema enviando la invitación por email');
        } else {
          console.log('✅ Invitación enviada exitosamente:', invitationData);
          toast.success('Usuario creado e invitación enviada correctamente');
        }
      } catch (inviteError) {
        console.error('Error sending invitation:', inviteError);
        toast.warning('Usuario creado, pero no se pudo enviar la invitación por email');
      }

      await fetchUsers();
      await fetchInvitations();
      return { success: true };
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Error al crear el usuario');
      return { success: false, error: error.message };
    } finally {
      setCreating(false);
    }
  };

  const resendInvitation = async (userId: string) => {
    try {
      setSendingInvitation(userId);
      console.log('📧 Reenviando invitación para usuario:', userId);
      
      const user = users.find(u => u.id === userId);
      if (!user) {
        toast.error('Usuario no encontrado');
        return;
      }

      const clientName = user.client_id ? 
        clients.find(c => c.id === user.client_id)?.name : undefined;

      console.log('Resending invitation with data:', {
        userId: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        clientName
      });

      const { data, error } = await supabase.functions.invoke('send-user-invitation', {
        body: {
          userId: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          clientName
        }
      });

      console.log('Resend invitation result:', { data, error });

      if (error) {
        throw error;
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        console.log('✅ Invitación reenviada exitosamente');
        toast.success('Invitación reenviada correctamente');
      }

      await fetchInvitations();
    } catch (error: any) {
      console.error('Error resending invitation:', error);
      toast.error('Error al reenviar la invitación');
    } finally {
      setSendingInvitation(null);
    }
  };

  const getInvitationStatus = (userId: string) => {
    return invitations.find(inv => inv.user_id === userId);
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'operator' | 'viewer' | 'client') => {
    try {
      setUpdating(userId);
      const { error } = await (supabase as any).rpc('update_user_role', {
        user_id: userId,
        new_role: newRole
      });

      if (error) throw error;

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
      const { error } = await supabase
        .from('profiles')
        .update({ client_id: clientId, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;

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
      const { error } = await (supabase as any).rpc('toggle_user_status', {
        user_id: userId,
        new_status: newStatus
      });

      if (error) throw error;

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
    fetchInvitations();
  }, []);

  return {
    users,
    clients,
    invitations,
    loading,
    updating,
    creating,
    sendingInvitation,
    createUser,
    resendInvitation,
    getInvitationStatus,
    updateUserRole,
    assignClientToUser,
    toggleUserStatus,
    refetchUsers: fetchUsers
  };
};
