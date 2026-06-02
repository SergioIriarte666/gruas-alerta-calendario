
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('UserContext');

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'viewer' | 'client';
  client_id?: string;
  avatar_url?: string | null;
  operator_id?: string | null;
  operator_name?: string | null;
}

interface UserContextType {
  user: UserProfile | null;
  loading: boolean;
  /** @deprecated Usa `signOut()` de `useAuth()` en su lugar. Este método ahora solo limpia estado local y delega a AuthContext. */
  logout: () => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => Promise<void>;
  forceRefreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: authUser, loading: authLoading, signOut } = useAuth();
  const profileCacheRef = useRef<{ profile: UserProfile; userId: string } | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);

  const fetchUserProfile = async (retryCount = 0) => {
    if (!authUser || fetchingRef.current) {
      setLoading(false);
      return;
    }

    // Use cached profile if available
    if (profileCacheRef.current?.userId === authUser.id && profileCacheRef.current?.profile) {
      setUser(profileCacheRef.current.profile);
      setLoading(false);
      return;
    }

    fetchingRef.current = true;

    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, client_id, avatar_url')
        .eq('id', authUser.id)
        .single();

      if (error) {
        logger.error('UserContext - Error fetching profile:', error);

        if (error.code === 'PGRST116') {
          // Profile doesn't exist, create one
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: authUser.id,
              email: authUser.email,
              full_name: authUser.email,
              role: 'client'
            })
            .select('id, email, full_name, role, client_id, avatar_url')
            .single();

          if (createError) {
            if (retryCount < 2) {
              fetchingRef.current = false;
              setTimeout(() => fetchUserProfile(retryCount + 1), 1000 * (retryCount + 1));
              return;
            }
            setUser(null);
          } else {
            const userProfile: UserProfile = {
              id: newProfile.id,
              email: newProfile.email,
              name: newProfile.full_name || newProfile.email,
              role: newProfile.role,
              client_id: newProfile.client_id,
              avatar_url: newProfile.avatar_url,
              operator_id: null,
              operator_name: null,
            };
            profileCacheRef.current = { profile: userProfile, userId: authUser.id };
            setUser(userProfile);
          }
        } else if (retryCount < 2) {
          fetchingRef.current = false;
          setTimeout(() => fetchUserProfile(retryCount + 1), 1000 * (retryCount + 1));
          return;
        } else {
          setUser(null);
        }
      } else {
        let operator_id: string | null = null;
        let operator_name: string | null = null;
        try {
          const { data: operatorData, error: operatorError } = await supabase
            .from('operators')
            .select('id, name')
            .eq('user_id', authUser.id)
            .maybeSingle();
          if (!operatorError && operatorData) {
            operator_id = operatorData.id;
            operator_name = operatorData.name;
          }
        } catch (operatorException) {
          logger.error('UserContext - Error fetching operator profile:', operatorException);
        }

        const userProfile: UserProfile = {
          id: profileData.id,
          email: profileData.email,
          name: profileData.full_name || profileData.email,
          role: profileData.role,
          client_id: profileData.client_id,
          avatar_url: profileData.avatar_url,
          operator_id,
          operator_name,
        };
        profileCacheRef.current = { profile: userProfile, userId: authUser.id };
        setUser(userProfile);
      }
    } catch (error) {
      logger.error('UserContext - Exception:', error);
      if (retryCount < 2) {
        fetchingRef.current = false;
        setTimeout(() => fetchUserProfile(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      setUser(null);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const forceRefreshProfile = async () => {
    fetchingRef.current = false;
    // Don't set loading to true if we have cached data
    if (!profileCacheRef.current?.profile || profileCacheRef.current?.userId !== authUser?.id) {
      setLoading(true);
    }
    await fetchUserProfile();
  };

  const updateUser = async (updates: Partial<UserProfile>) => {
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
      full_name: updates.name,
      email: updates.email,
      avatar_url: updates.avatar_url,
      updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (!error) {
      const updatedUser = { ...user, ...updates };
      profileCacheRef.current = { profile: updatedUser, userId: user.id };
      setUser(updatedUser);
    }
  };

  const logout = async () => {
    try {
      profileCacheRef.current = null;
      setUser(null);
      setLoading(false);
      fetchingRef.current = false;
      await signOut();
    } catch (error) {
      logger.error('UserContext - Logout error:', error);
      profileCacheRef.current = null;
      setUser(null);
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (authLoading) return;

    if (!authUser) {
      profileCacheRef.current = null;
      setUser(null);
      setLoading(false);
      fetchingRef.current = false;
      return;
    }

    // If we already have a cached profile for this user, use it immediately
    if (profileCacheRef.current?.userId === authUser.id && profileCacheRef.current?.profile) {
      setUser(profileCacheRef.current.profile);
      setLoading(false);
      return;
    }

    fetchUserProfile();
  }, [authUser, authLoading]);

  return (
    <UserContext.Provider value={{
      user,
      loading,
      logout,
      updateUser,
      forceRefreshProfile
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    // During HMR, context may temporarily be undefined - return safe defaults
    logger.warn('useUser called outside UserProvider (likely HMR). Returning defaults.');
    return {
      user: null,
      loading: true,
      logout: async () => {},
      updateUser: async () => {},
      forceRefreshProfile: async () => {},
    } as UserContextType;
  }
  return context;
};
