
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
  const [retryCount, setRetryCount] = React.useState(0);
  const maxRetries = 3;
  const retryDelay = 2000;

  const fetchProfile = React.useCallback(async (attempt = 0) => {
    console.log('fetchProfile called. authUser:', !!authUser, 'session:', !!session, 'authLoading:', authLoading, 'attempt:', attempt);
    if (authLoading) return;

    if (authUser && session) {
      setProfileLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .eq('id', authUser.id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        } else if (data) {
          console.log("Profile data received:", data);
          setUser({
            id: data.id,
            name: data.full_name || 'Usuario',
            email: data.email,
            role: data.role || 'viewer',
          });
          setError(null);
          setRetryCount(0);
        } else {
          console.warn("Profile not found for authenticated user.");
          // Only logout if we've exceeded retry attempts
          if (attempt >= maxRetries) {
            setError("No se encontró tu perfil. Se cerrará la sesión para proteger tu cuenta.");
            await signOut();
          } else {
            throw new Error("Profile not found");
          }
        }
      } catch (e) {
        console.error("Error fetching profile:", e);
        
        // Check if it's a network error or temporary issue
        const isNetworkError = e?.message?.includes('fetch') || 
                              e?.message?.includes('network') ||
                              e?.code === 'PGRST301' ||
                              !navigator.onLine;
        
        if (isNetworkError && attempt < maxRetries) {
          console.log(`Network error detected, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries})`);
          setError(`Problema de conectividad. Reintentando... (${attempt + 1}/${maxRetries})`);
          setRetryCount(attempt + 1);
          
          setTimeout(() => {
            fetchProfile(attempt + 1);
          }, retryDelay * (attempt + 1)); // Exponential backoff
          return;
        }
        
        // If it's a critical error or we've exceeded retries
        if (attempt >= maxRetries) {
          setError("Error persistente al cargar tu perfil. Se cerrará la sesión por seguridad.");
          await signOut();
        } else {
          setError("Error temporal al cargar tu perfil. Reintentando...");
          setTimeout(() => {
            fetchProfile(attempt + 1);
          }, retryDelay);
        }
      } finally {
        setProfileLoading(false);
      }
    } else {
      console.log("No authenticated user or session, clearing user data.");
      setUser(null);
      setProfileLoading(false);
      setError(null);
      setRetryCount(0);
    }
  }, [authLoading, authUser, session, signOut]);

  React.useEffect(() => {
    let isMounted = true;
    
    // Timeout más largo para dar más tiempo
    const timeoutId = setTimeout(() => {
        if(isMounted && profileLoading && authUser) {
            console.error('Profile loading timeout.');
            setProfileLoading(false);
            setError('La carga de la sesión está tardando demasiado. Verifica tu conexión.');
        }
    }, 30000); // 30 second timeout instead of 15

    fetchProfile();

    return () => {
        isMounted = false;
        clearTimeout(timeoutId);
    };
  }, [fetchProfile]);

  // Listen for network status changes
  React.useEffect(() => {
    const handleOnline = () => {
      if (error && authUser && !user) {
        console.log('Network back online, retrying profile fetch');
        setError(null);
        fetchProfile();
      }
    };

    const handleOffline = () => {
      setError('Sin conexión a internet. Algunos datos pueden no estar actualizados.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [error, authUser, user, fetchProfile]);
  
  const login = () => { /* Deprecated: Handled by Auth page */ };

  const logout = async () => {
    cleanupAuthState();
    await signOut();
    setUser(null);
    setError(null);
    setRetryCount(0);
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
    setRetryCount(0);
    fetchProfile();
  };

  const isAuthenticated = !!authUser && !!session;
  const isLoading = authLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-4">Cargando sesión...</div>
          {retryCount > 0 && (
            <div className="text-sm text-gray-400">
              Reintento {retryCount}/{maxRetries}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error && !user) {
    const isNetworkError = error.includes('conectividad') || error.includes('conexión');
    
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white text-center p-4">
        <h2 className="text-xl font-bold mb-2 text-red-400">
          {isNetworkError ? 'Problema de Conexión' : 'Error de Sesión'}
        </h2>
        <p className="mb-4 max-w-md">{error}</p>
        <div className="space-y-2">
          <Button onClick={retryFetchProfile} className="bg-tms-green hover:bg-tms-green-dark">
            Reintentar
          </Button>
          {!isNetworkError && (
            <Button variant="link" onClick={logout} className="mt-2 text-gray-400">
              Cerrar sesión
            </Button>
          )}
        </div>
        {!navigator.onLine && (
          <div className="mt-4 text-sm text-yellow-400">
            ⚠️ Sin conexión a internet
          </div>
        )}
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
