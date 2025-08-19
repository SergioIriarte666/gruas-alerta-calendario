
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

    // Get initial session with enhanced error handling and retries
    const getInitialSession = async () => {
      try {
        console.log('AuthContext: Getting initial session...');
        
        // First, verify Supabase connectivity
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('AuthContext: Error getting session:', error);
          
          // If JWT is expired or invalid, clean up
          if (error.message?.includes('JWT') || error.message?.includes('expired')) {
            console.log('AuthContext: JWT expired/invalid, cleaning up...');
            cleanupAuthState();
            setSession(null);
            setUser(null);
            setLoading(false);
            return;
          }
          
          throw error;
        }
        
        if (mounted) {
          console.log('AuthContext: Initial session retrieved:', !!initialSession);
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          
          // If we have a session, verify it can access the database
          if (initialSession) {
            try {
              console.log('AuthContext: Verifying database connectivity...');
              const { error: dbError } = await supabase
                .from('profiles')
                .select('id')
                .limit(1);
                
              if (dbError) {
                console.error('AuthContext: Database access failed:', dbError);
                
                // If RLS policy fails, it might be a stale session
                if (dbError.code === 'PGRST116' || dbError.message?.includes('RLS')) {
                  console.log('AuthContext: RLS policy failed, session may be stale');
                  // Try to refresh the session
                  const { data: { session: refreshedSession }, error: refreshError } = 
                    await supabase.auth.refreshSession();
                    
                  if (refreshError || !refreshedSession) {
                    console.log('AuthContext: Session refresh failed, cleaning up');
                    cleanupAuthState();
                    setSession(null);
                    setUser(null);
                  } else {
                    console.log('AuthContext: Session refreshed successfully');
                    setSession(refreshedSession);
                    setUser(refreshedSession.user);
                  }
                }
              } else {
                console.log('AuthContext: Database connectivity verified');
              }
            } catch (dbError) {
              console.error('AuthContext: Database verification failed:', dbError);
            }
          }
        }
      } catch (error: any) {
        console.error('AuthContext: Critical error getting initial session:', error);
        
        // For network errors, provide user feedback
        if (error.message?.includes('fetch') || error.message?.includes('network')) {
          console.error('AuthContext: Network connectivity issue detected');
        }
        
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
          console.log('AuthContext: Auth state change:', event, 'Session valid:', !!session);
          
          // Enhanced session validation
          if (session) {
            console.log('AuthContext: Session details - User ID:', session.user?.id, 'Expires at:', session.expires_at);
            
            // Check if session is close to expiring (within 5 minutes)
            if (session.expires_at) {
              const expiresAt = new Date(session.expires_at * 1000);
              const now = new Date();
              const fiveMinutes = 5 * 60 * 1000;
              
              if (expiresAt.getTime() - now.getTime() < fiveMinutes) {
                console.log('AuthContext: Session expires soon, refreshing...');
                // Defer refresh to avoid blocking the auth state change
                setTimeout(async () => {
                  try {
                    await supabase.auth.refreshSession();
                  } catch (error) {
                    console.error('AuthContext: Failed to refresh expiring session:', error);
                  }
                }, 0);
              }
            }
          }
          
          setSession(session);
          setUser(session?.user ?? null);
          
          // Only set loading to false after we have processed the session
          if (loading) {
            setLoading(false);
          }
        }
      }
    );

    getInitialSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loading]);

  const signOut = async () => {
    try {
      console.log('AuthContext: Starting sign out process...');
      
      // Step 1: Clean up auth state first
      cleanupAuthState();
      
      // Step 2: Perform global sign out
      await performGlobalSignOut(supabase);
      
      // Step 3: Clear local state immediately
      setSession(null);
      setUser(null);
      
      console.log('AuthContext: Sign out completed, forcing redirect...');
      
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
      console.log('AuthContext: Refreshing session...');
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('AuthContext: Session refresh error:', error);
        // Clear invalid session
        setSession(null);
        setUser(null);
        throw error;
      }
      
      console.log('AuthContext: Session refreshed successfully', !!session);
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
