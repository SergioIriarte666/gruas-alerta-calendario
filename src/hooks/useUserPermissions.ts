import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useUserPermissions");
export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer' | 'client';
  full_name?: string;
}

export const useUserPermissions = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      try {
        // First check session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        logger.debug('🔑 useUserPermissions: Session check:', !!session, 'User ID:', session?.user?.id);
        
        if (sessionError || !session || !session.user) {
          logger.debug('❌ useUserPermissions: No valid session');
          setIsAuthenticated(false);
          setUser(null);
          setIsLoading(false);
          return;
        }

        // Double check with getUser for consistency
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        logger.debug('👤 useUserPermissions: Auth user check:', !!authUser, 'User ID:', authUser?.id);
        
        if (authError || !authUser) {
          logger.debug('❌ useUserPermissions: Auth user check failed');
          setIsAuthenticated(false);
          setUser(null);
          setIsLoading(false);
          return;
        }

        setIsAuthenticated(true);

        // Get user profile with role
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, email, role, full_name')
          .eq('id', authUser.id)
          .single();

        if (error) {
          logger.error('❌ useUserPermissions: Error fetching user profile:', error);
          setUser(null);
        } else {
          logger.debug('✅ useUserPermissions: User profile loaded:', profile.email, 'Role:', profile.role);
          setUser(profile);
        }
      } catch (error) {
        logger.error('❌ useUserPermissions: Error checking authentication:', error);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setIsAuthenticated(false);
        setUser(null);
        setIsLoading(false);
      } else if (event === 'SIGNED_IN' && session) {
        getUser();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const canCreateAlerts = () => {
    return isAuthenticated && user && ['admin', 'operator'].includes(user.role);
  };

  const canViewAlerts = () => {
    return isAuthenticated && user;
  };

  const canModifyAlerts = () => {
    return isAuthenticated && user && ['admin', 'operator'].includes(user.role);
  };

  const isAdmin = () => {
    return isAuthenticated && user?.role === 'admin';
  };

  const isOperator = () => {
    return isAuthenticated && user?.role === 'operator';
  };

  const isClient = () => {
    return isAuthenticated && user?.role === 'client';
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    canCreateAlerts: canCreateAlerts(),
    canViewAlerts: canViewAlerts(),
    canModifyAlerts: canModifyAlerts(),
    isAdmin: isAdmin(),
    isOperator: isOperator(),
    isClient: isClient(),
  };
};