
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

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

  const fetchUserProfile = async () => {
    if (!authUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('UserContext - Fetching profile for user:', authUser.id, authUser.email);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        console.error('UserContext - Error fetching user profile:', error);
        
        // Si el perfil no existe, intentar crearlo
        if (error.code === 'PGRST116') {
          console.log('UserContext - Profile not found, attempting to create...');
          
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: authUser.id,
              email: authUser.email || '',
              full_name: authUser.email || '',
              role: 'viewer'
            })
            .select()
            .single();

          if (createError) {
            console.error('UserContext - Error creating profile:', createError);
            setUser(null);
          } else if (newProfile) {
            console.log('UserContext - Profile created successfully:', newProfile);
            setUser({
              id: newProfile.id,
              email: newProfile.email,
              name: newProfile.full_name || newProfile.email,
              role: newProfile.role,
              client_id: newProfile.client_id,
            });
          }
        } else {
          setUser(null);
        }
      } else if (data) {
        console.log('UserContext - Profile fetched successfully:', data);
        
        // Validar que el rol sea válido
        const validRoles = ['admin', 'operator', 'viewer', 'client'];
        if (!validRoles.includes(data.role)) {
          console.error('UserContext - Invalid role detected:', data.role);
          setUser(null);
          return;
        }

        setUser({
          id: data.id,
          email: data.email,
          name: data.full_name || data.email,
          role: data.role,
          client_id: data.client_id,
        });
      }
    } catch (error) {
      console.error('UserContext - Exception in fetchUserProfile:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const forceRefreshProfile = async () => {
    console.log('UserContext - Force refreshing profile...');
    await fetchUserProfile();
  };

  const updateUser = async (updates: Partial<UserProfile>) => {
    if (!user) return;

    try {
      console.log('UserContext - Updating user:', updates);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: updates.name,
          email: updates.email,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      // Update local state
      setUser(prev => prev ? { ...prev, ...updates } : null);
      console.log('UserContext - User updated successfully');
    } catch (error) {
      console.error('UserContext - Error updating user:', error);
      throw error;
    }
  };

  const logout = async () => {
    console.log('UserContext - Logging out user...');
    await signOut();
  };

  useEffect(() => {
    if (authLoading) {
      console.log('UserContext - Auth still loading, waiting...');
      return;
    }

    console.log('UserContext - Auth loading complete, fetching profile...');
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
