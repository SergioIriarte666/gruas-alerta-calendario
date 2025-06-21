
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    const initializeAuth = async () => {
      try {
        setLoading(true);
        
        // Set up the auth state listener first
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, session) => {
            console.log('Auth state changed:', event, !!session);
            if (mounted) {
              setSession(session);
              setUser(session?.user ?? null);
              if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
                setLoading(false);
              }
            }
          }
        );

        // Then get the current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          // If there's an error getting session, clear it and continue
          if (mounted) {
            setSession(null);
            setUser(null);
            setLoading(false);
          }
        } else {
          if (mounted) {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
          }
        }

        // Cleanup function
        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      }
    };

    const cleanupSubscription = initializeAuth();

    // Set a maximum timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth initialization timed out, setting loading to false');
        setLoading(false);
      }
    }, 10000); // 10 seconds max

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      cleanupSubscription?.then(cleanup => cleanup?.());
    };
  }, []);

  const signOut = async () => {
    try {
      console.log('Signing out...');
      setLoading(true);
      await supabase.auth.signOut();
      // State will be updated by the onAuthStateChange listener
    } catch (error) {
      console.error('Error signing out:', error);
      // Force clear state even if signOut fails
      setSession(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    session,
    user,
    loading,
    signOut,
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
