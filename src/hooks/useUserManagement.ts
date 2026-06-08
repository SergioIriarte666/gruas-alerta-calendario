import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useUserManagement");
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
  operator_id: string | null;
  operator_name: string | null;
}

interface Client {
  id: string;
  name: string;
  rut: string;
  email: string | null;
  department?: string | null;
}

interface Operator {
  id: string;
  name: string;
  rut: string;
}

interface CreateUserData {
  email: string;
  full_name: string;
  role: 'admin' | 'operator' | 'viewer' | 'client';
  client_id?: string | null;
  operator_id?: string | null;
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

const USER_INVITATIONS_SELECT = `
  id,
  user_id,
  email,
  status,
  sent_at,
  accepted_at,
  created_at
`;

export const useUserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [sendingInvitation, setSendingInvitation] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_all_users');
      
      if (error) throw error;
      
      const rawUsers = (Array.isArray(data) ? data : []) as Omit<User, 'operator_id' | 'operator_name'>[];
      const userIds = rawUsers.map(u => u.id).filter(Boolean);

      let operatorRows: { id: string; name: string; user_id: string | null }[] = [];
      if (userIds.length > 0) {
        const { data: operatorData, error: operatorError } = await supabase
          .from('operators')
          .select('id, name, user_id')
          .in('user_id', userIds);

        if (operatorError) throw operatorError;
        operatorRows = Array.isArray(operatorData) ? (operatorData as any) : [];
      }

      const operatorByUserId = new Map<string, { id: string; name: string }>();
      for (const op of operatorRows) {
        if (op.user_id) operatorByUserId.set(op.user_id, { id: op.id, name: op.name });
      }

      const enrichedUsers: User[] = rawUsers.map(u => {
        const operator = operatorByUserId.get(u.id);
        return {
          ...(u as any),
          operator_id: operator?.id || null,
          operator_name: operator?.name || null,
        };
      });

      setUsers(enrichedUsers);
    } catch (error) {
      logger.error('Error fetching users:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('user_invitations')
        .select(USER_INVITATIONS_SELECT)
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
      logger.error('Error fetching invitations:', error);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, rut, email, department')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      
      setClients(Array.isArray(data) ? data : []);
    } catch (error) {
      logger.error('Error fetching clients:', error);
    }
  };

  const fetchOperators = async () => {
    try {
      const { data, error } = await supabase
        .from('operators')
        .select('id, name, rut')
        .eq('is_active', true)
        .is('user_id', null) // Solo operadores sin usuario vinculado
        .order('name');
      
      if (error) throw error;
      
      setOperators(Array.isArray(data) ? data : []);
    } catch (error) {
      logger.error('Error fetching operators:', error);
    }
  };

  const assignOperatorToUser = async (userId: string, operatorId: string | null) => {
    try {
      setUpdating(userId);

      const { data: existingOperatorLinks, error: existingError } = await supabase
        .from('operators')
        .select('id')
        .eq('user_id', userId);

      if (existingError) throw existingError;

      const existingOperatorId = Array.isArray(existingOperatorLinks) && existingOperatorLinks.length > 0
        ? existingOperatorLinks[0].id
        : null;

      if (operatorId) {
        const { data: operatorRow, error: operatorRowError } = await supabase
          .from('operators')
          .select('id, user_id')
          .eq('id', operatorId)
          .single();

        if (operatorRowError) throw operatorRowError;

        if (operatorRow.user_id && operatorRow.user_id !== userId) {
          throw new Error('Este operador ya está vinculado a otro usuario');
        }
      }

      if (existingOperatorId && existingOperatorId !== operatorId) {
        const { error: unlinkError } = await supabase
          .from('operators')
          .update({ user_id: null, updated_at: new Date().toISOString() })
          .eq('id', existingOperatorId);

        if (unlinkError) throw unlinkError;
      }

      if (operatorId) {
        const { error: linkError } = await supabase
          .from('operators')
          .update({ user_id: userId, updated_at: new Date().toISOString() })
          .eq('id', operatorId);

        if (linkError) throw linkError;
        toast.success('Operador vinculado correctamente');
      } else {
        toast.success('Operador desvinculado correctamente');
      }

      await fetchUsers();
      await fetchOperators();
      return { success: true };
    } catch (error: any) {
      logger.error('Error assigning operator to user:', error);
      toast.error(error.message || 'Error al vincular el operador');
      return { success: false, error: error.message };
    } finally {
      setUpdating(null);
    }
  };

  const createUser = async (userData: CreateUserData) => {
    try {
      setCreating(true);
      // Call the edge function which handles everything:
      // 1. Creates user in Supabase Auth via admin.inviteUserByEmail
      // 2. Creates profile with matching ID
      // 3. Links operator if applicable
      // 4. Creates invitation record
      // 5. Sends invitation email via Supabase native email
      const { data: invitationData, error: invitationError } = await supabase.functions.invoke('send-user-invitation', {
        body: {
          email: userData.email,
          fullName: userData.full_name,
          role: userData.role,
          clientId: userData.client_id || null,
          operatorId: userData.operator_id || null
        }
      });

      if (invitationError) {
        logger.error('Error in invitation function:', invitationError);
        throw new Error(invitationError.message || 'Error al crear usuario');
      }
      
      if (invitationData?.error) {
        logger.error('Error from invitation function:', invitationData.error);
        throw new Error(invitationData.error);
      }

      toast.success('Usuario creado e invitación enviada por email');

      await fetchUsers();
      await fetchInvitations();
      await fetchOperators();
      return { success: true };
    } catch (error: any) {
      logger.error('Error creating user:', error);
      toast.error(error.message || 'Error al crear el usuario');
      return { success: false, error: error.message };
    } finally {
      setCreating(false);
    }
  };

  const resendInvitation = async (userId: string) => {
    try {
      setSendingInvitation(userId);
      
      const user = users.find(u => u.id === userId);
      if (!user) {
        toast.error('Usuario no encontrado');
        return;
      }

      const clientName = user.client_id ? 
        clients.find(c => c.id === user.client_id)?.name : undefined;

      const { data, error } = await supabase.functions.invoke('send-user-invitation', {
        body: {
          userId: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          clientName
        }
      });

      if (error) {
        throw error;
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        toast.success('Invitación reenviada correctamente');
      }

      await fetchInvitations();
    } catch (error: any) {
      logger.error('Error resending invitation:', error);
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
      const { error } = await supabase.rpc('update_user_role', {
        target_user_id: userId,
        new_role: newRole
      });

      if (error) throw error;

      toast.success('Rol actualizado correctamente');
      await fetchUsers();
    } catch (error) {
      logger.error('Error updating user role:', error);
      toast.error('Error al actualizar el rol del usuario');
    } finally {
      setUpdating(null);
    }
  };

  const assignClientToUser = async (userId: string, clientId: string | null) => {
    try {
      setUpdating(userId);
      const { error } = await supabase.rpc('assign_user_client', {
        target_user_id: userId,
        target_client_id: clientId,
      });

      if (error) throw error;

      toast.success('Cliente asignado correctamente');
      await fetchUsers();
      return { success: true };
    } catch (error: any) {
      logger.error('Error assigning client to user:', error);
      toast.error(error.message || 'Error al asignar cliente al usuario');
      return { success: false, error: error.message };
    } finally {
      setUpdating(null);
    }
  };

  const toggleUserStatus = async (userId: string, newStatus: boolean) => {
    try {
      setUpdating(userId);
      const { error } = await supabase.rpc('toggle_user_status', {
        user_id: userId,
        new_status: newStatus
      });

      if (error) throw error;

      toast.success(`Usuario ${newStatus ? 'activado' : 'desactivado'} correctamente`);
      await fetchUsers();
    } catch (error) {
      logger.error('Error updating user status:', error);
      toast.error('Error al cambiar el estado del usuario');
    } finally {
      setUpdating(null);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      setUpdating(userId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sesión no válida');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar usuario');

      toast.success('Usuario eliminado correctamente');
      await fetchUsers();
      await fetchInvitations();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al eliminar el usuario';
      logger.error('Error deleting user:', error);
      toast.error(message);
    } finally {
      setUpdating(null);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchClients();
    fetchOperators();
    fetchInvitations();
  }, []);

  return {
    users,
    clients,
    operators,
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
    assignOperatorToUser,
    toggleUserStatus,
    deleteUser,
    refetchUsers: fetchUsers
  };
};
