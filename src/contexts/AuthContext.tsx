
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { cleanupAuthState, performGlobalSignOut } from '@/utils/authCleanup';

const debugLog = (..._args: unknown[]) => {
  // Debug logging disabled for performance
};

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

    // Get initial session with enhanced error handling and retries
    const getInitialSession = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          if (error.message?.includes('JWT') || error.message?.includes('expired')) {
            cleanupAuthState();
          }
          if (mounted) {
            setSession(null);
            setUser(null);
          }
          return;
        }
        
        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
        }
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

    // Set up auth state listener with enhanced handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      }
    );

    getInitialSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      debugLog('AuthContext: Starting sign out process...');
      
      // Step 1: Clean up auth state first
      cleanupAuthState();
      
      // Step 2: Perform global sign out
      await performGlobalSignOut(supabase);
      
      // Step 3: Clear local state immediately
      setSession(null);
      setUser(null);
      
      debugLog('AuthContext: Sign out completed, forcing redirect...');
      
      // Step 4: Force complete page reload to ensure clean state
      window.location.href = '/auth';
    } catch (error) {
      console.error('AuthContext: Error during sign out:', error);
      
      // Force cleanup and redirect even if there's an error
      cleanupAuthState();
      setSession(null);
      setUser(null);
      window.location.href = '/auth';
    }
  };

  const refreshSession = async () => {
    try {
      debugLog('AuthContext: Refreshing session...');
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('AuthContext: Session refresh error:', error);
        // Clear invalid session
        setSession(null);
        setUser(null);
        throw error;
      }
      
      debugLog('AuthContext: Session refreshed successfully', !!session);
      setSession(session);
      setUser(session?.user ?? null);
    } catch (error) {
      console.error('AuthContext: Failed to refresh session:', error);
      throw error;
    }
  };

  const value = {
    session,
    user,
    loading,
    signOut,
    refreshSession,
  };

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
