
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { cleanupAuthState, performGlobalSignOut } from '@/utils/authCleanup';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  forceRefresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const getInitialSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting initial session:', error);
      }
      console.log('Initial session check:', session ? 'has session' : 'no session');
      setSession(session);
      setUser(session?.user ?? null);
    } catch (error) {
      console.error('Unexpected error getting session:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('AuthProvider: Initializing authentication...');
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, session ? 'has session' : 'no session');
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Get initial session
    getInitialSession();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      console.log('AuthProvider: Signing out...');
      
      // Limpiar estado local inmediatamente
      setSession(null);
      setUser(null);
      
      // Limpiar estado de autenticación
      cleanupAuthState();
      
      // Intentar cerrar sesión global
      await performGlobalSignOut(supabase);
      
      // Forzar recarga completa para limpiar cualquier estado residual
      setTimeout(() => {
        window.location.href = '/auth';
      }, 100);
    } catch (error) {
      console.error('Error signing out:', error);
      // Forzar limpieza y redirección incluso si hay error
      cleanupAuthState();
      setSession(null);
      setUser(null);
      window.location.href = '/auth';
    }
  };

  const forceRefresh = async () => {
    try {
      console.log('AuthProvider: Force refreshing session...');
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Error refreshing session:', error);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
    } catch (error) {
      console.error('Error force refreshing session:', error);
    }
  };

  const value = {
    session,
    user,
    loading,
    signOut,
    forceRefresh,
  };

  console.log('AuthProvider render:', { 
    hasSession: !!session, 
    hasUser: !!user, 
    loading 
  });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
