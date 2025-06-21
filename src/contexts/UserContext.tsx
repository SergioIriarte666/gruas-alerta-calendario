
import * as React from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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

  const fetchProfile = React.useCallback(async () => {
    if (authLoading || !authUser || !session) {
      return;
    }

    setProfileLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('id', authUser.id)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError('Perfil no encontrado. Es posible que necesites completar la configuración.');
        } else {
          throw fetchError;
        }
      } else if (data) {
        setUser({
          id: data.id,
          name: data.full_name || 'Usuario',
          email: data.email,
          role: data.role || 'viewer',
        });
        setError(null);
      }
    } catch (e: any) {
      console.error("Error fetching profile:", e);
      setError("Error al cargar tu perfil.");
    } finally {
      setProfileLoading(false);
    }
  }, [authLoading, authUser, session]);

  React.useEffect(() => {
    if (!authLoading) {
      if (authUser && session) {
        fetchProfile();
      } else {
        setUser(null);
        setError(null);
      }
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
    setError(null);
    fetchProfile();
  };

  const isAuthenticated = !!authUser && !!session;
  const isLoading = authLoading || profileLoading;

  // Show loading only for initial auth check
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-4">Cargando sesión...</div>
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // Show error screen only for profile errors when authenticated
  if (error && !user && isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white text-center p-4">
        <h2 className="text-xl font-bold mb-2 text-red-400">Error de Perfil</h2>
        <p className="mb-4 max-w-md">{error}</p>
        <div className="space-y-2">
          <Button onClick={retryFetchProfile} className="bg-tms-green hover:bg-tms-green-dark">
            Reintentar
          </Button>
          <Button variant="link" onClick={logout} className="mt-2 text-gray-400">
            Cerrar sesión
          </Button>
        </div>
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
      isAuthenticated,
      error,
      retryFetchProfile
    }}>
      {children}
    </UserContext.Provider>
  );
}
