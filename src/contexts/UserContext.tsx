import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  login: (userData: User) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  isAuthenticated: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const { user: authUser, session, signOut, loading: authLoading } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && authUser && session) {
      setProfileLoading(true);
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .eq('id', authUser.id)
          .single();

        if (error && error.code !== 'PGRST116') { // 'PGRST116' es 'no rows returned'
          console.error("Error fetching user profile", error);
          // En caso de un error crítico con la base de datos, cerramos sesión por seguridad.
          await signOut();
        } else if (data) {
          setUser({
            id: data.id,
            name: data.full_name || 'Usuario',
            email: data.email,
            role: data.role || 'viewer',
          });
        } else {
          // Si no se encuentra un perfil, es un estado inconsistente para un usuario logueado.
          // El trigger debería prevenir esto. Para cualquier otro caso, cerrar sesión es lo más seguro.
          console.warn("Profile not found for authenticated user. Logging out to prevent inconsistent state.");
          await signOut();
        }
        setProfileLoading(false);
      };
      fetchProfile();
    } else if (!authLoading) {
      setUser(null);
      setProfileLoading(false);
    }
  }, [authUser, session, authLoading, signOut]);
  
  const login = () => { /* Deprecated: Handled by Auth page */ };

  const logout = () => {
    signOut();
  };

  const updateUser = async (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: updatedUser.name, email: updatedUser.email, role: updatedUser.role as any })
        .eq('id', user.id);
      
      if(error) {
        console.error("Error updating user profile", error);
      }
    }
  };

  const isAuthenticated = !!authUser && !!session;
  const isLoading = authLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div>Cargando sesión...</div>
      </div>
    );
  }

  return (
    <UserContext.Provider value={{
      user,
      loading: isLoading,
      login,
      logout,
      updateUser,
      isAuthenticated
    }}>
      {children}
    </UserContext.Provider>
  );
}
