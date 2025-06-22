import * as React from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer' | 'client';
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  login: (userData: User) => void;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  isAuthenticated: boolean;
  error: string | null;
  retryFetchProfile: () => void;
  forceRefreshProfile: () => void;
}

const UserContext = React.createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = React.useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: React.ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const { user: authUser, session, signOut, loading: authLoading } = useAuth();
  const [user, setUser] = React.useState<User | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const fetchProfile = React.useCallback(async (userId: string) => {
    console.log('UserContext: Fetching profile for user:', userId);
    setProfileLoading(true);
    setError(null);

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        console.error('UserContext: No valid session found');
        setError('Sesión no válida. Por favor, inicia sesión nuevamente.');
        setUser(null);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('id', userId)
        .single();

      console.log('UserContext: Profile query result:', { data, error: fetchError });

      if (fetchError) {
        console.error('UserContext: Error fetching profile:', fetchError.message);
        setError(`Error al cargar perfil: ${fetchError.message}`);
        setUser(null);
      } else if (data) {
        const normalizedRole = data.role?.toLowerCase();
        const validRoles = ['admin', 'operator', 'viewer', 'client'];
        const userRole = validRoles.includes(normalizedRole) 
          ? normalizedRole as 'admin' | 'operator' | 'viewer' | 'client'
          : 'viewer';
        
        const userData = {
          id: data.id,
          name: data.full_name || 'Usuario',
          email: data.email,
          role: userRole,
        };
        console.log('UserContext: Profile loaded successfully:', userData);
        setUser(userData);
        setError(null);
      }
    } catch (e: any) {
      console.error("UserContext: Unexpected error:", e.message);
      setError(`Error inesperado: ${e.message}`);
      setUser(null);
    } finally {
      setProfileLoading(false);
    }
  }, [refreshTrigger]);

  React.useEffect(() => {
    if (authLoading) return;

    if (authUser && session) {
      fetchProfile(authUser.id);
    } else {
      setUser(null);
      setError(null);
      setProfileLoading(false);
    }
  }, [authUser, session, authLoading, fetchProfile]);
  
  const login = () => { /* Handled by Auth page */ };

  const logout = async () => {
    console.log('UserContext: Starting logout...');
    setUser(null);
    setError(null);
    setProfileLoading(false);
    await signOut();
  };

  const updateUser = async (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      
      try {
        const updateData: {
          full_name: string;
          email: string;
          role: 'admin' | 'operator' | 'viewer' | 'client';
        } = {
          full_name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
        };

        const { error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', user.id);
        
        if (error) {
          console.error("Error updating user profile:", error);
        }
      } catch (e) {
        console.error("Unexpected error updating profile:", e);
      }
    }
  };

  const retryFetchProfile = () => {
    if (authUser) {
      console.log('UserContext: Retrying profile fetch...');
      setError(null);
      fetchProfile(authUser.id);
    }
  };

  const forceRefreshProfile = () => {
    console.log('UserContext: Force refreshing profile...');
    setRefreshTrigger(prev => prev + 1);
  };

  const isAuthenticated = !!authUser && !!session;
  const isLoading = authLoading || profileLoading;

  return (
    <UserContext.Provider value={{
      user,
      loading: isLoading,
      login,
      logout,
      updateUser,
      isAuthenticated,
      error,
      retryFetchProfile,
      forceRefreshProfile
    }}>
      {children}
    </UserContext.Provider>
  );
}
