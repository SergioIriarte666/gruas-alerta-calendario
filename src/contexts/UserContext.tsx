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

  const fetchUserProfile = async () => {
    if (!authUser || fetchingRef.current) {
      setLoading(false);
      return;
    }

    fetchingRef.current = true;
    
    try {
      console.log(`UserContext - Fetching profile for: ${authUser.email} (ID: ${authUser.id})`);
      
      // Buscar perfil por email primero
      const { data: existingProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', authUser.email)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('UserContext - Error fetching profile:', error);
        setUser(null);
        setLoading(false);
        fetchingRef.current = false;
        return;
      }

      if (existingProfile) {
        console.log('UserContext - Profile found:', existingProfile);
        
        // Si el ID del perfil no coincide con el ID del usuario autenticado, actualizarlo
        if (existingProfile.id !== authUser.id) {
          console.log(`UserContext - ID mismatch detected. Profile ID: ${existingProfile.id}, Auth ID: ${authUser.id}`);
          console.log('UserContext - Updating profile ID to match auth user ID...');
          
          try {
            // Actualizar el ID del perfil para que coincida con el usuario autenticado
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ id: authUser.id })
              .eq('email', authUser.email);

            if (updateError) {
              console.error('UserContext - Error updating profile ID:', updateError);
              // Si no se puede actualizar, crear un nuevo perfil con el ID correcto
              const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert({
                  id: authUser.id,
                  email: authUser.email,
                  full_name: existingProfile.full_name || authUser.email,
                  role: existingProfile.role || 'client',
                  client_id: existingProfile.client_id,
                })
                .select()
                .single();

              if (createError) {
                console.error('UserContext - Error creating new profile:', createError);
                setUser(null);
                setLoading(false);
                fetchingRef.current = false;
                return;
              }

              // Eliminar el perfil antiguo con ID incorrecto
              await supabase
                .from('profiles')
                .delete()
                .eq('email', authUser.email)
                .neq('id', authUser.id);

              existingProfile.id = authUser.id;
            } else {
              console.log('UserContext - Profile ID updated successfully');
              existingProfile.id = authUser.id;
            }
          } catch (updateException) {
            console.error('UserContext - Exception updating profile:', updateException);
          }
        }

        const userProfile = {
          id: authUser.id, // Usar siempre el ID del usuario autenticado
          email: existingProfile.email,
          name: existingProfile.full_name || existingProfile.email,
          role: existingProfile.role,
          client_id: existingProfile.client_id,
        };
        setUser(userProfile);
      } else {
        console.log('UserContext - No profile found, creating one for user:', authUser.email);
        
        // Crear perfil automáticamente si no existe, usando el ID correcto
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: authUser.id, // Usar el ID del usuario autenticado
            email: authUser.email,
            full_name: authUser.email,
            role: 'client' // Asignar rol por defecto
          })
          .select()
          .single();

        if (createError) {
          console.error('UserContext - Error creating profile:', createError);
          setUser(null);
        } else {
          console.log('UserContext - Profile created:', newProfile);
          const userProfile = {
            id: newProfile.id,
            email: newProfile.email,
            name: newProfile.full_name || newProfile.email,
            role: newProfile.role,
            client_id: newProfile.client_id,
          };
          setUser(userProfile);
        }
      }
    } catch (error) {
      console.error('UserContext - Exception:', error);
      setUser(null);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const forceRefreshProfile = async () => {
    fetchingRef.current = false;
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
