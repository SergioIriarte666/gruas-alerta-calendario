
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { businessClock } from '@/utils/businessClock';
import { createLogger } from '@/lib/logger';

const logger = createLogger('UserContext');
// v2 fuerza a perfiles anteriores a volver a resolver operator_id. Sin ese dato,
// la bitácora quedaba deshabilitada silenciosamente después de una actualización.
const PROFILE_CACHE_KEY = 'offline-user-profile-cache-v2';

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

type AccountStatus = 'pending' | 'approved' | 'rejected' | null;

interface UserContextType {
  user: UserProfile | null;
  accountStatus: AccountStatus;
  loading: boolean;
  /** @deprecated Usa `signOut()` de `useAuth()` en su lugar. Este método ahora solo limpia estado local y delega a AuthContext. */
  logout: () => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => Promise<void>;
  forceRefreshProfile: () => Promise<void>;
}

const readCachedProfile = (): { profile: UserProfile; userId: string } | null => {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { profile: UserProfile; userId: string };
  } catch (error) {
    logger.warn('UserContext - Could not parse cached profile', error);
    return null;
  }
};

const writeCachedProfile = (value: { profile: UserProfile; userId: string } | null) => {
  if (!value) {
    localStorage.removeItem(PROFILE_CACHE_KEY);
    return;
  }

  localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(value));
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: authUser, loading: authLoading, signOut } = useAuth();
  const profileCacheRef = useRef<{ profile: UserProfile; userId: string } | null>(readCachedProfile());
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accountStatus, setAccountStatus] = useState<AccountStatus>(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);
  const attemptedPendingRepairRef = useRef<string | null>(null);

  const tryRepairPendingInvitedProfile = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('repair-invited-user-profile');
      if (error) {
        logger.warn('UserContext - Pending profile repair failed:', error);
        return false;
      }

      return Boolean(data?.repaired);
    } catch (repairError) {
      logger.warn('UserContext - Pending profile repair exception:', repairError);
      return false;
    }
  };

  const fetchUserProfile = async (retryCount = 0) => {
    if (!authUser || fetchingRef.current) {
      if (!authUser && !navigator.onLine && profileCacheRef.current?.profile?.role === 'operator') {
        setUser(profileCacheRef.current.profile);
        setAccountStatus('approved');
      }
      setLoading(false);
      return;
    }

    // Use cached profile if available
    if (profileCacheRef.current?.userId === authUser.id && profileCacheRef.current?.profile) {
      setUser(profileCacheRef.current.profile);
      setAccountStatus('approved');
      setLoading(false);
      return;
    }

    fetchingRef.current = true;

    try {
      const { data: initialProfileData, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, client_id, avatar_url, status')
        .eq('id', authUser.id)
        .single();
      let profileData = initialProfileData;

      if (error) {
        logger.error('UserContext - Error fetching profile:', error);

        if (!navigator.onLine && profileCacheRef.current?.userId === authUser.id && profileCacheRef.current.profile) {
          logger.warn('UserContext - Falling back to cached profile while offline');
          setUser(profileCacheRef.current.profile);
          return;
        }

        if (error.code === 'PGRST116') {
          if (retryCount < 2) {
            fetchingRef.current = false;
            setTimeout(() => fetchUserProfile(retryCount + 1), 1000 * (retryCount + 1));
            return;
          }
          logger.warn('UserContext - Profile missing after retries, keeping user without profile');
          setUser(null);
        } else if (retryCount < 2) {
          fetchingRef.current = false;
          setTimeout(() => fetchUserProfile(retryCount + 1), 1000 * (retryCount + 1));
          return;
        } else {
          setUser(null);
        }
      } else {
        if (authUser.user_metadata?.invited === true && attemptedPendingRepairRef.current !== authUser.id) {
          attemptedPendingRepairRef.current = authUser.id;
          const repaired = await tryRepairPendingInvitedProfile();
          if (repaired) {
            const refreshedProfile = await supabase
              .from('profiles')
              .select('id, email, full_name, role, client_id, avatar_url, status')
              .eq('id', authUser.id)
              .single();

            if (!refreshedProfile.error && refreshedProfile.data) {
              profileData = refreshedProfile.data;
            }
          }
        }

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

        const status = profileData.status as AccountStatus;
        setAccountStatus(status);

        if (status === 'pending') {
          logger.warn('UserContext - Profile pending approval');
          profileCacheRef.current = null;
          writeCachedProfile(null);
          setUser(null);
          setLoading(false);
          fetchingRef.current = false;
          if (window.location.pathname !== '/pending') {
            window.location.replace('/pending');
          }
          return;
        }

        if (status === 'rejected') {
          logger.warn('UserContext - Profile rejected');
          setUser(null);
          setLoading(false);
          fetchingRef.current = false;
          await signOut();
          return;
        }

        if (status !== 'approved') {
          logger.warn('UserContext - Unknown profile status:', status);
          setUser(null);
          return;
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
        writeCachedProfile(profileCacheRef.current);
        setAccountStatus('approved');
        setUser(userProfile);
      }
    } catch (error) {
      logger.error('UserContext - Exception:', error);
      if (!navigator.onLine && authUser && profileCacheRef.current?.userId === authUser.id && profileCacheRef.current.profile) {
        logger.warn('UserContext - Using cached profile after exception while offline');
        setUser(profileCacheRef.current.profile);
        setLoading(false);
        fetchingRef.current = false;
        return;
      }
      if (retryCount < 2) {
        fetchingRef.current = false;
        setTimeout(() => fetchUserProfile(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      setUser(null);
      setAccountStatus(null);
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
      updated_at: businessClock.nowISO()
      })
      .eq('id', user.id);

    if (!error) {
      const updatedUser = { ...user, ...updates };
      profileCacheRef.current = { profile: updatedUser, userId: user.id };
      writeCachedProfile(profileCacheRef.current);
      setUser(updatedUser);
    }
  };

  const logout = async () => {
    try {
      profileCacheRef.current = null;
      writeCachedProfile(null);
      setUser(null);
      setAccountStatus(null);
      setLoading(false);
      fetchingRef.current = false;
      await signOut();
    } catch (error) {
      logger.error('UserContext - Logout error:', error);
      profileCacheRef.current = null;
      writeCachedProfile(null);
      setUser(null);
      setAccountStatus(null);
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (authLoading) return;

    if (!authUser) {
      if (!navigator.onLine && profileCacheRef.current?.profile?.role === 'operator') {
        setUser(profileCacheRef.current.profile);
        setAccountStatus('approved');
        setLoading(false);
        fetchingRef.current = false;
        return;
      }
      profileCacheRef.current = null;
      writeCachedProfile(null);
      attemptedPendingRepairRef.current = null;
      setUser(null);
      setAccountStatus(null);
      setLoading(false);
      fetchingRef.current = false;
      return;
    }

    // If we already have a cached profile for this user, use it immediately
    if (profileCacheRef.current?.userId === authUser.id && profileCacheRef.current?.profile) {
      setUser(profileCacheRef.current.profile);
      setAccountStatus('approved');
      setLoading(false);
      return;
    }

    fetchUserProfile();
  }, [authUser, authLoading]);

  return (
    <UserContext.Provider value={{
      user,
      accountStatus,
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
      accountStatus: null,
      loading: true,
      logout: async () => {},
      updateUser: async () => {},
      forceRefreshProfile: async () => {},
    } as UserContextType;
  }
  return context;
};
