
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
  const [profileLoading, setProfileLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchProfile = React.useCallback(async () => {
    console.log('fetchProfile called. authUser:', !!authUser, 'session:', !!session, 'authLoading:', authLoading);
    if (authLoading) return;

    if (authUser && session) {
      setProfileLoading(true);
      setError(null);
      console.log('Fetching profile for user:', authUser.id);
      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .eq('id', authUser.id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error("Error fetching user profile", fetchError);
          setError("Hubo un error al cargar tu perfil.");
          await signOut();
        } else if (data) {
          console.log("Profile data received:", data);
          setUser({
            id: data.id,
            name: data.full_name || 'Usuario',
            email: data.email,
            role: data.role || 'viewer',
          });
        } else {
          console.warn("Profile not found for authenticated user. Logging out...");
          setError("No se encontró tu perfil. Se cerrará la sesión para proteger tu cuenta.");
          await signOut();
        }
      } catch (e) {
        console.error("Catastrophic error fetching profile:", e);
        setError("Ocurrió un error inesperado al cargar tu perfil.");
        await signOut();
      } finally {
        setProfileLoading(false);
      }
    } else {
      console.log("No authenticated user or session, clearing user data.");
      setUser(null);
      setProfileLoading(false);
      setError(null);
    }
  }, [authLoading, authUser, session, signOut]);

  React.useEffect(() => {
    let isMounted = true;
    
    const timeoutId = setTimeout(() => {
        if(isMounted && profileLoading) {
            console.error('Profile loading timeout.');
            setProfileLoading(false);
            setError('La carga de la sesión está tardando demasiado. Por favor, revisa tu conexión a internet y reintenta.');
        }
    }, 15000); // 15 second timeout

    fetchProfile();

    return () => {
        isMounted = false;
        clearTimeout(timeoutId);
    };
  }, [fetchProfile]);
  
  const login = () => { /* Deprecated: Handled by Auth page */ };

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

  const isAuthenticated = !!authUser && !!session;
  const isLoading = authLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div>Cargando sesión...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white text-center p-4">
        <h2 className="text-xl font-bold mb-2 text-red-400">Error de Sesión</h2>
        <p className="mb-4 max-w-md">{error}</p>
        <Button onClick={fetchProfile} className="bg-tms-green hover:bg-tms-green-dark">Reintentar</Button>
        <Button variant="link" onClick={logout} className="mt-2 text-gray-400">Cerrar sesión</Button>
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
      retryFetchProfile: fetchProfile
    }}>
      {children}
    </UserContext.Provider>
  );
}
