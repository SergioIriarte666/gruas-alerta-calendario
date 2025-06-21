
import * as React from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
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
        console.error('UserContext: Error fetching profile:', fetchError);
        if (fetchError.code === 'PGRST116') {
          setError('Perfil no encontrado. Es posible que necesites completar la configuración.');
        } else {
          setError('Error al cargar tu perfil.');
        }
        setUser(null);
      } else if (data) {
        // Ensure role is one of the valid types
        const validRoles: Array<'admin' | 'operator' | 'viewer'> = ['admin', 'operator', 'viewer'];
        const userRole = validRoles.includes(data.role as any) ? data.role as 'admin' | 'operator' | 'viewer' : 'viewer';
        
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
      console.error("UserContext: Unexpected error:", e);
      setError("Error inesperado al cargar el perfil.");
      setUser(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  React.useEffect(() => {
    console.log('UserContext: Auth state effect - authLoading:', authLoading, 'authUser:', !!authUser);
    
    if (authLoading) {
      return;
    }

    if (authUser && session) {
      fetchProfile(authUser.id);
    } else {
      console.log('UserContext: No authenticated user, clearing profile');
      setUser(null);
      setError(null);
      setProfileLoading(false);
    }
  }, [authUser, session, authLoading, fetchProfile]);
  
  const login = () => { /* Handled by Auth page */ };

  const logout = async () => {
    console.log('UserContext: Logging out...');
    await signOut();
    setUser(null);
    setError(null);
  };

  const updateUser = async (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ 
            full_name: updatedUser.name, 
            email: updatedUser.email, 
            role: updatedUser.role 
          })
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
      setError(null);
      fetchProfile(authUser.id);
    }
  };

  const isAuthenticated = !!authUser && !!session;
  const isLoading = authLoading || profileLoading;

  console.log('UserContext render:', { 
    isLoading, 
    isAuthenticated, 
    hasUser: !!user, 
    userRole: user?.role,
    error 
  });

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
