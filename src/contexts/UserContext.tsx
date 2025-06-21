
import * as React from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cleanupAuthState } from '@/utils/authCleanup';

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
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  isAuthenticated: boolean;
  error: string | null;
  retryFetchProfile: () => void;
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

  const fetchProfile = React.useCallback(async (userId: string) => {
    console.log('UserContext: Fetching profile for user:', userId);
    setProfileLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('id', userId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          console.log('UserContext: Profile not found');
          setError('Perfil no encontrado. Es posible que necesites completar la configuración.');
        } else {
          throw fetchError;
        }
      } else if (data) {
        console.log('UserContext: Profile loaded successfully');
        setUser({
          id: data.id,
          name: data.full_name || 'Usuario',
          email: data.email,
          role: data.role || 'viewer',
        });
        setError(null);
      }
    } catch (e: any) {
      console.error("UserContext: Error fetching profile:", e);
      setError("Error al cargar tu perfil.");
    } finally {
      setProfileLoading(false);
    }
  }, []);

  React.useEffect(() => {
    console.log('UserContext: Auth state changed - authLoading:', authLoading, 'authUser:', !!authUser);
    
    if (authLoading) {
      console.log('UserContext: Auth still loading, waiting...');
      return;
    }

    if (authUser && session) {
      console.log('UserContext: User authenticated, fetching profile...');
      fetchProfile(authUser.id);
    } else {
      console.log('UserContext: No authenticated user, clearing state');
      setUser(null);
      setError(null);
      setProfileLoading(false);
    }
  }, [authUser, session, authLoading, fetchProfile]);
  
  const login = () => { /* Handled by Auth page */ };

  const logout = async () => {
    cleanupAuthState();
    await signOut();
    setUser(null);
    setError(null);
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

  const retryFetchProfile = () => {
    if (authUser) {
      setError(null);
      fetchProfile(authUser.id);
    }
  };

  const isAuthenticated = !!authUser && !!session;
  const isLoading = authLoading || profileLoading;

  console.log('UserContext: Current state - isLoading:', isLoading, 'isAuthenticated:', isAuthenticated, 'user:', !!user);

  return (
    <UserContext.Provider value={{
      user,
      loading: isLoading,
      login,
      logout,
      updateUser,
      isAuthenticated,
      error,
      retryFetchProfile
    }}>
      {children}
    </UserContext.Provider>
  );
}
