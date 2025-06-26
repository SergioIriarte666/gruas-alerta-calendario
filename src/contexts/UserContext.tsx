import React, { createContext, useContext, useState, useEffect } from 'react';
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

  const fetchUserProfile = async (forceRefresh = false) => {
    if (!authUser) {
      console.log('UserContext - No auth user, clearing profile');
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log(`UserContext - Fetching profile for user: ${authUser.id} (${authUser.email}) - Force refresh: ${forceRefresh}`);
      
      // Si es force refresh, limpiar cualquier cache local
      if (forceRefresh) {
        console.log('UserContext - Force refresh: clearing local cache and waiting');
        setUser(null);
        // Pequeño delay para asegurar que la base de datos esté actualizada
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
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
          
          // Para el usuario pagos@gruas5norte.cl, crear con rol client
          const defaultRole = authUser.email === 'pagos@gruas5norte.cl' ? 'client' : 'viewer';
          
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: authUser.id,
              email: authUser.email || '',
              full_name: authUser.email || '',
              role: defaultRole
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
        console.log('UserContext - Profile fetched successfully:', {
          id: data.id,
          email: data.email,
          role: data.role,
          client_id: data.client_id,
          full_name: data.full_name
        });
        
        // Validar que el rol sea válido
        const validRoles = ['admin', 'operator', 'viewer', 'client'];
        if (!validRoles.includes(data.role)) {
          console.error('UserContext - Invalid role detected:', data.role);
          
          // Si el rol es inválido, intentar corregirlo
          const correctedRole = data.email === 'pagos@gruas5norte.cl' ? 'client' : 'viewer';
          console.log(`UserContext - Attempting to correct role to: ${correctedRole}`);
          
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ role: correctedRole })
            .eq('id', data.id);
            
          if (!updateError) {
            setUser({
              id: data.id,
              email: data.email,
              name: data.full_name || data.email,
              role: correctedRole,
              client_id: data.client_id,
            });
          } else {
            console.error('UserContext - Error correcting role:', updateError);
            setUser(null);
          }
          return;
        }

        const userProfile = {
          id: data.id,
          email: data.email,
          name: data.full_name || data.email,
          role: data.role,
          client_id: data.client_id,
        };

        console.log('UserContext - Setting user profile:', userProfile);
        setUser(userProfile);
      }
    } catch (error) {
      console.error('UserContext - Exception in fetchUserProfile:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const forceRefreshProfile = async () => {
    console.log('UserContext - Force refreshing profile with delay and cache clear...');
    await fetchUserProfile(true);
    
    // Verificar que el perfil se haya cargado correctamente
    if (!user && authUser) {
      console.warn('UserContext - Profile still null after force refresh, retrying...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await fetchUserProfile(true);
    }
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
    try {
      console.log('UserContext - Starting logout process...');
      
      // Step 1: Clear user state immediately
      setUser(null);
      setLoading(false);
      
      // Step 2: Clean up auth state
      cleanupAuthState();
      
      // Step 3: Perform global sign out
      await performGlobalSignOut(supabase);
      
      console.log('UserContext - Logout completed, forcing redirect...');
      
      // Step 4: Force complete page reload to ensure clean state
      window.location.href = '/auth';
    } catch (error) {
      console.error('UserContext - Error during logout:', error);
      
      // Force cleanup and redirect even if there's an error
      cleanupAuthState();
      setUser(null);
      setLoading(false);
      window.location.href = '/auth';
    }
  };

  useEffect(() => {
    if (authLoading) {
      console.log('UserContext - Auth still loading, waiting...');
      return;
    }

    console.log('UserContext - Auth loading complete, fetching profile...');
    fetchUserProfile(false);
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
