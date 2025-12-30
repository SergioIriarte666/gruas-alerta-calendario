
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
}

interface UserContextType {
  user: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => Promise<void>;
  forceRefreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: authUser, loading: authLoading, signOut } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const fetchUserProfile = async (retryCount = 0) => {
    if (!authUser || fetchingRef.current) {
      setLoading(false);
      return;
    }

    fetchingRef.current = true;
    
    try {
      console.log(`UserContext - Fetching profile for: ${authUser.email} (ID: ${authUser.id}), attempt: ${retryCount + 1}`);
      
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        console.error('UserContext - Error fetching profile:', error);
        
        // If no profile exists, create one
        if (error.code === 'PGRST116') {
          console.log('UserContext - Creating new profile...');
          
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: authUser.id,
              email: authUser.email,
              full_name: authUser.email,
              role: 'client'
            })
            .select()
            .single();

          if (createError) {
            console.error('UserContext - Error creating profile:', createError);
            
            // Retry if we haven't exceeded max retries
            if (retryCount < maxRetries) {
              console.log(`UserContext - Retrying profile creation (${retryCount + 1}/${maxRetries})`);
              setTimeout(() => {
                fetchingRef.current = false;
                fetchUserProfile(retryCount + 1);
              }, 1000 * (retryCount + 1)); // Exponential backoff
              return;
            }
            
            setUser(null);
          } else {
            const userProfile = {
              id: newProfile.id,
              email: newProfile.email,
              name: newProfile.full_name || newProfile.email,
              role: newProfile.role,
              client_id: newProfile.client_id,
            };
            console.log('UserContext - New profile created:', userProfile);
            setUser(userProfile);
            retryCountRef.current = 0; // Reset retry count on success
          }
        } else {
          // For other errors, retry if possible
          if (retryCount < maxRetries) {
            console.log(`UserContext - Retrying profile fetch (${retryCount + 1}/${maxRetries}) after error:`, error.message);
            setTimeout(() => {
              fetchingRef.current = false;
              fetchUserProfile(retryCount + 1);
            }, 1000 * (retryCount + 1)); // Exponential backoff
            return;
          }
          
          console.error('UserContext - Max retries exceeded, setting user to null');
          setUser(null);
        }
      } else {
        // Profile found successfully
        const userProfile = {
          id: profileData.id,
          email: profileData.email,
          name: profileData.full_name || profileData.email,
          role: profileData.role,
          client_id: profileData.client_id,
        };
        console.log('UserContext - Profile found:', userProfile);
        setUser(userProfile);
        retryCountRef.current = 0; // Reset retry count on success
      }

    } catch (error) {
      console.error('UserContext - Exception:', error);
      
      // Retry on exceptions if possible
      if (retryCount < maxRetries) {
        console.log(`UserContext - Retrying after exception (${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          fetchingRef.current = false;
          fetchUserProfile(retryCount + 1);
        }, 1000 * (retryCount + 1)); // Exponential backoff
        return;
      }
      
      setUser(null);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const forceRefreshProfile = async () => {
    console.log('UserContext - Force refresh profile requested');
    fetchingRef.current = false;
    retryCountRef.current = 0;
    setUser(null);
    setLoading(true);
    await fetchUserProfile();
  };

  const updateUser = async (updates: Partial<UserProfile>) => {
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: updates.name,
        email: updates.email,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (!error) {
      setUser(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const logout = async () => {
    try {
      console.log('UserContext - Logout initiated...');
      setUser(null);
      setLoading(false);
      fetchingRef.current = false;
      retryCountRef.current = 0;
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
    if (authLoading) {
      console.log('UserContext - Auth still loading, waiting...');
      return;
    }
    
    if (!authUser) {
      console.log('UserContext - No auth user, clearing profile');
      setUser(null);
      setLoading(false);
      fetchingRef.current = false;
      retryCountRef.current = 0;
      return;
    }
    
    console.log('UserContext - Auth user available, fetching profile');
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
