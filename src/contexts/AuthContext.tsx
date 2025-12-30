
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { cleanupAuthState, performGlobalSignOut } from '@/utils/authCleanup';
import { OFFLINE_HYDRATION_EVENT } from './OfflineModeContext';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session cache keys
const SESSION_CACHE_KEY = 'tms-session-cache';
const USER_CACHE_KEY = 'tms-user-cache';

// Cache functions
const saveSessionToCache = (session: Session | null) => {
  try {
    if (session) {
      localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
        ...session,
        cachedAt: Date.now()
      }));
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(session.user));
    } else {
      localStorage.removeItem(SESSION_CACHE_KEY);
      localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch (error) {
    console.warn('AuthContext: Failed to cache session:', error);
  }
};

const getSessionFromCache = (): { session: Session | null; user: User | null } => {
  try {
    const cachedSession = localStorage.getItem(SESSION_CACHE_KEY);
    const cachedUser = localStorage.getItem(USER_CACHE_KEY);
    
    if (!cachedSession || !cachedUser) {
      return { session: null, user: null };
    }
    
    const session = JSON.parse(cachedSession);
    const user = JSON.parse(cachedUser);
    
    // Check if cache is not too old (7 days)
    if (Date.now() - session.cachedAt > 7 * 24 * 60 * 60 * 1000) {
      console.log('AuthContext: Cached session expired');
      return { session: null, user: null };
    }
    
    // Remove cachedAt from session object
    const { cachedAt, ...sessionData } = session;
    
    console.log('AuthContext: Session loaded from cache');
    return { session: sessionData, user };
  } catch (error) {
    console.warn('AuthContext: Failed to read cached session:', error);
    return { session: null, user: null };
  }
};

const clearSessionCache = () => {
  try {
    localStorage.removeItem(SESSION_CACHE_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
  } catch (error) {
    console.warn('AuthContext: Failed to clear session cache:', error);
  }
};

// Helper to check if we're truly online
const checkIsOnline = (): boolean => {
  // Check localStorage for forced offline mode
  try {
    const forceOffline = localStorage.getItem('tms-force-offline-mode') === 'true';
    return navigator.onLine && !forceOffline;
  } catch {
    return navigator.onLine;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load from cache immediately on mount (for offline-first)
  const loadFromCache = useCallback(() => {
    const { session: cachedSession, user: cachedUser } = getSessionFromCache();
    if (cachedSession && cachedUser) {
      console.log('AuthContext: Hydrating from cache');
      setSession(cachedSession);
      setUser(cachedUser);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    let mounted = true;
    const isOnline = checkIsOnline();

    // Get initial session with enhanced error handling
    const getInitialSession = async () => {
      console.log('AuthContext: Getting initial session... Online:', isOnline);
      
      // If offline, load from cache immediately and don't make network requests
      if (!isOnline) {
        console.log('AuthContext: Offline - loading from cache only');
        const loaded = loadFromCache();
        if (mounted) {
          if (!loaded) {
            console.log('AuthContext: No cached session available while offline');
          }
          setLoading(false);
        }
        return;
      }
      
      try {
        // Try to get session from Supabase
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('AuthContext: Error getting session:', error);
          
          // If JWT is expired or invalid, clean up
          if (error.message?.includes('JWT') || error.message?.includes('expired')) {
            console.log('AuthContext: JWT expired/invalid, cleaning up...');
            cleanupAuthState();
            clearSessionCache();
            setSession(null);
            setUser(null);
            setLoading(false);
            return;
          }
          
          // For other errors, try cache
          loadFromCache();
          if (mounted) setLoading(false);
          return;
        }
        
        if (mounted) {
          console.log('AuthContext: Initial session retrieved:', !!initialSession);
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          
          // Cache the session for offline use
          if (initialSession) {
            saveSessionToCache(initialSession);
          }
        }
      } catch (error: any) {
        console.error('AuthContext: Critical error getting initial session:', error);
        
        // For network errors, try to use cache
        if (error.message?.includes('fetch') || error.message?.includes('network')) {
          console.log('AuthContext: Network error - attempting cache load');
          loadFromCache();
        }
        
        if (mounted) {
          setLoading(false);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (mounted) {
          console.log('AuthContext: Auth state change:', event, 'Session valid:', !!newSession);
          
          setSession(newSession);
          setUser(newSession?.user ?? null);
          
          // Cache session on changes (only when online)
          if (checkIsOnline()) {
            saveSessionToCache(newSession);
          }
          
          // Handle session refresh
          if (newSession?.expires_at) {
            const expiresAt = new Date(newSession.expires_at * 1000);
            const now = new Date();
            const fiveMinutes = 5 * 60 * 1000;
            
            if (expiresAt.getTime() - now.getTime() < fiveMinutes && checkIsOnline()) {
              console.log('AuthContext: Session expires soon, refreshing...');
              setTimeout(async () => {
                try {
                  await supabase.auth.refreshSession();
                } catch (error) {
                  console.error('AuthContext: Failed to refresh expiring session:', error);
                }
              }, 0);
            }
          }
          
          if (loading) {
            setLoading(false);
          }
        }
      }
    );

    // Listen for offline hydration events
    const handleOfflineHydration = () => {
      console.log('AuthContext: Received offline hydration event');
      const isStillOnline = checkIsOnline();
      if (!isStillOnline) {
        loadFromCache();
      }
    };
    
    window.addEventListener(OFFLINE_HYDRATION_EVENT, handleOfflineHydration);

    getInitialSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener(OFFLINE_HYDRATION_EVENT, handleOfflineHydration);
    };
  }, [loadFromCache, loading]);

  const signOut = async () => {
    try {
      console.log('AuthContext: Starting sign out process...');
      
      // Clear caches
      clearSessionCache();
      cleanupAuthState();
      
      // Perform global sign out
      await performGlobalSignOut(supabase);
      
      // Clear local state
      setSession(null);
      setUser(null);
      
      console.log('AuthContext: Sign out completed, forcing redirect...');
      window.location.href = '/auth';
    } catch (error) {
      console.error('AuthContext: Error during sign out:', error);
      
      // Force cleanup and redirect even if there's an error
      clearSessionCache();
      cleanupAuthState();
      setSession(null);
      setUser(null);
      window.location.href = '/auth';
    }
  };

  const refreshSession = async () => {
    if (!checkIsOnline()) {
      console.log('AuthContext: Offline - cannot refresh session');
      return;
    }
    
    try {
      console.log('AuthContext: Refreshing session...');
      const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('AuthContext: Session refresh error:', error);
        setSession(null);
        setUser(null);
        throw error;
      }
      
      console.log('AuthContext: Session refreshed successfully', !!refreshedSession);
      setSession(refreshedSession);
      setUser(refreshedSession?.user ?? null);
      
      if (refreshedSession) {
        saveSessionToCache(refreshedSession);
      }
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
