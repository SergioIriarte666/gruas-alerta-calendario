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
  const isLoadingRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const fetchUserProfile = async (forceRefresh = false) => {
    // Prevenir ejecuciones simultáneas
    if (isLoadingRef.current && !forceRefresh) {
      console.log('UserContext - Profile fetch already in progress, skipping');
      return;
    }

    if (!authUser) {
      console.log('UserContext - No auth user, clearing profile');
      setUser(null);
      setLoading(false);
      isLoadingRef.current = false;
      retryCountRef.current = 0;
      return;
    }

    try {
      isLoadingRef.current = true;
      setLoading(true);
      console.log(`UserContext - Fetching profile for user: ${authUser.id} (${authUser.email}) - Force refresh: ${forceRefresh} - Retry: ${retryCountRef.current}`);
      
      // Si es force refresh, limpiar cualquier cache local
      if (forceRefresh) {
        console.log('UserContext - Force refresh: clearing local cache and waiting');
        setUser(null);
        // Pequeño delay para asegurar que la base de datos esté actualizada
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Usar maybeSingle() para evitar errores cuando no se encuentra el perfil
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('UserContext - Error fetching user profile:', error);
        throw error;
      }

      if (!data) {
        console.log('UserContext - Profile not found, attempting to create...');
        
        // Verificar si realmente no existe antes de crear
        const { data: existingProfile, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', authUser.id)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('UserContext - Error checking existing profile:', checkError);
          throw checkError;
        }

        if (existingProfile) {
          console.log('UserContext - Profile exists, refetching...');
          // El perfil existe, intentar cargar de nuevo
          const { data: refetchedProfile, error: refetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();

          if (refetchError) throw refetchError;
          
          if (refetchedProfile) {
            const userProfile = {
              id: refetchedProfile.id,
              email: refetchedProfile.email,
              name: refetchedProfile.full_name || refetchedProfile.email,
              role: refetchedProfile.role,
              client_id: refetchedProfile.client_id,
            };
            console.log('UserContext - Profile refetched successfully:', userProfile);
            setUser(userProfile);
            retryCountRef.current = 0;
            return;
          }
        }
        
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
          
          // Si el error es que ya existe, intentar cargar el perfil existente
          if (createError.code === '23505') { // Duplicate key error
            console.log('UserContext - Profile already exists, attempting to fetch...');
            const { data: existingData, error: fetchExistingError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', authUser.id)
              .single();
              
            if (!fetchExistingError && existingData) {
              const userProfile = {
                id: existingData.id,
                email: existingData.email,
                name: existingData.full_name || existingData.email,
                role: existingData.role,
                client_id: existingData.client_id,
              };
              console.log('UserContext - Existing profile loaded:', userProfile);
              setUser(userProfile);
              retryCountRef.current = 0;
              return;
            }
          }
          throw createError;
        }

        if (newProfile) {
          console.log('UserContext - Profile created successfully:', newProfile);
          setUser({
            id: newProfile.id,
            email: newProfile.email,
            name: newProfile.full_name || newProfile.email,
            role: newProfile.role,
            client_id: newProfile.client_id,
          });
          retryCountRef.current = 0;
        }
      } else {
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
            retryCountRef.current = 0;
          } else {
            console.error('UserContext - Error correcting role:', updateError);
            throw updateError;
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
        retryCountRef.current = 0;
      }
    } catch (error) {
      console.error('UserContext - Exception in fetchUserProfile:', error);
      
      // Implementar retry con backoff
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const retryDelay = Math.pow(2, retryCountRef.current) * 1000; // Exponential backoff
        console.log(`UserContext - Retrying in ${retryDelay}ms (attempt ${retryCountRef.current}/${maxRetries})`);
        
        setTimeout(() => {
          fetchUserProfile(forceRefresh);
        }, retryDelay);
        return;
      } else {
        console.error('UserContext - Max retries exceeded, giving up');
        setUser(null);
        retryCountRef.current = 0;
      }
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  const forceRefreshProfile = async () => {
    console.log('UserContext - Force refreshing profile with improved retry logic...');
    retryCountRef.current = 0;
    await fetchUserProfile(true);
    
    // Verificar que el perfil se haya cargado correctamente con timeout
    const checkProfileLoaded = () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Profile loading timeout'));
        }, 10000); // 10 segundos timeout

        const checkInterval = setInterval(() => {
          if (user && !loading) {
            clearTimeout(timeout);
            clearInterval(checkInterval);
            resolve();
          } else if (!loading && !user && authUser && retryCountRef.current >= maxRetries) {
            clearTimeout(timeout);
            clearInterval(checkInterval);
            reject(new Error('Profile loading failed after max retries'));
          }
        }, 500);
      });
    };

    try {
      await checkProfileLoaded();
      console.log('UserContext - Profile loaded successfully after force refresh');
    } catch (error) {
      console.error('UserContext - Force refresh failed:', error);
      // Intentar un último retry manual
      if (authUser && !user && retryCountRef.current >= maxRetries) {
        console.log('UserContext - Final retry attempt...');
        retryCountRef.current = 0;
        await fetchUserProfile(true);
      }
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
      isLoadingRef.current = false;
      retryCountRef.current = 0;
      
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
      isLoadingRef.current = false;
      retryCountRef.current = 0;
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
