
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cleanupAuthState, performGlobalSignOut } from '@/utils/authCleanup';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'viewer' | 'client';
  client_id?: string;
  avatar_url?: string | null;
}

interface UserContextType {
  user: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => Promise<void>;
  forceRefreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Module-level cache to survive remounts
let cachedProfile: UserProfile | null = null;
let cachedForUserId: string | null = null;

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: authUser, loading: authLoading, signOut } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(() => {
    // Initialize from cache if available for the same user
    if (authUser && cachedForUserId === authUser.id) return cachedProfile;
    return null;
  });
  const [loading, setLoading] = useState(() => {
    // If we have a cached profile for this user, skip loading
    if (authUser && cachedForUserId === authUser.id && cachedProfile) return false;
    return true;
  });
  const fetchingRef = useRef(false);

  const fetchUserProfile = async (retryCount = 0) => {
    if (!authUser || fetchingRef.current) {
      setLoading(false);
      return;
    }

    // Use cached profile if available
    if (cachedForUserId === authUser.id && cachedProfile) {
      setUser(cachedProfile);
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
        console.error('UserContext - Error fetching profile:', error);
        
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
            };
            cachedProfile = userProfile;
            cachedForUserId = authUser.id;
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
        const userProfile: UserProfile = {
          id: profileData.id,
          email: profileData.email,
          name: profileData.full_name || profileData.email,
          role: profileData.role,
          client_id: profileData.client_id,
          avatar_url: profileData.avatar_url,
        };
        cachedProfile = userProfile;
        cachedForUserId = authUser.id;
        setUser(userProfile);
      }
    } catch (error) {
      console.error('UserContext - Exception:', error);
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
    if (!cachedProfile || cachedForUserId !== authUser?.id) {
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
      cachedProfile = updatedUser;
      setUser(updatedUser);
    }
  };

  const logout = async () => {
    try {
      cachedProfile = null;
      cachedForUserId = null;
      setUser(null);
      setLoading(false);
      fetchingRef.current = false;
      cleanupAuthState();
      await performGlobalSignOut(supabase);
      window.location.href = '/auth';
    } catch (error) {
      console.error('UserContext - Logout error:', error);
      cleanupAuthState();
      setUser(null);
      window.location.href = '/auth';
    }
  };

  useEffect(() => {
    if (authLoading) return;
    
    if (!authUser) {
      cachedProfile = null;
      cachedForUserId = null;
      setUser(null);
      setLoading(false);
      fetchingRef.current = false;
      return;
    }

    // If we already have a cached profile for this user, use it immediately
    if (cachedForUserId === authUser.id && cachedProfile) {
      setUser(cachedProfile);
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
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
