
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { cleanupAuthState, performGlobalSignOut } from '@/utils/authCleanup';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Listener for ONGOING auth changes — does NOT control loading
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mounted) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        // Do NOT setLoading here — only the initial load controls it
      }
    );

    // INITIAL load — controls loading state
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          if (error.message?.includes('JWT') || error.message?.includes('expired')) {
            cleanupAuthState();
          }
          setSession(null);
          setUser(null);
          return;
        }

        setSession(initialSession);
        setUser(initialSession?.user ?? null);
      } catch (error) {
        console.error('AuthContext: Critical error:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      cleanupAuthState();
      await performGlobalSignOut(supabase);
      setSession(null);
      setUser(null);
      window.location.href = '/auth';
    } catch (error) {
      console.error('AuthContext: Error during sign out:', error);
      cleanupAuthState();
      setSession(null);
      setUser(null);
      window.location.href = '/auth';
    }
  };

  const refreshSession = async () => {
    try {
      const { data: { session: refreshed }, error } = await supabase.auth.refreshSession();
      if (error) {
        setSession(null);
        setUser(null);
        throw error;
      }
      setSession(refreshed);
      setUser(refreshed?.user ?? null);
    } catch (error) {
      console.error('AuthContext: Failed to refresh session:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut, refreshSession }}>
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
