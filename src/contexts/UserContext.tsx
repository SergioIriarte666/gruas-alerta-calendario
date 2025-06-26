
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
      
      // PASO 1: Buscar perfil por ID de usuario autenticado (método correcto)
      let { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('UserContext - Error fetching profile by ID:', error);
        setUser(null);
        setLoading(false);
        fetchingRef.current = false;
        return;
      }

      // PASO 2: Si no existe perfil con el ID correcto, buscar por email
      if (!profileData) {
        console.log('UserContext - No profile found by ID, searching by email...');
        
        const { data: emailProfile, error: emailError } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', authUser.email)
          .maybeSingle();

        if (emailError && emailError.code !== 'PGRST116') {
          console.error('UserContext - Error fetching profile by email:', emailError);
          setUser(null);
          setLoading(false);
          fetchingRef.current = false;
          return;
        }

        if (emailProfile) {
          console.log('UserContext - Found profile by email, deleting old profile and creating new one...');
          
          // Eliminar el perfil con ID incorrecto
          await supabase
            .from('profiles')
            .delete()
            .eq('email', authUser.email);

          // Crear nuevo perfil con ID correcto
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: authUser.id,
              email: authUser.email,
              full_name: emailProfile.full_name || authUser.email,
              role: emailProfile.role || 'client',
              client_id: emailProfile.client_id,
            })
            .select()
            .single();

          if (createError) {
            console.error('UserContext - Error creating corrected profile:', createError);
            setUser(null);
            setLoading(false);
            fetchingRef.current = false;
            return;
          }

          profileData = newProfile;
        }
      }

      // PASO 3: Si aún no hay perfil, crear uno nuevo
      if (!profileData) {
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
          setUser(null);
          setLoading(false);
          fetchingRef.current = false;
          return;
        }

        profileData = newProfile;
      }

      // PASO 4: Establecer el usuario
      if (profileData) {
        const userProfile = {
          id: profileData.id,
          email: profileData.email,
          name: profileData.full_name || profileData.email,
          role: profileData.role,
          client_id: profileData.client_id,
        };
        console.log('UserContext - Profile set successfully:', userProfile);
        setUser(userProfile);
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
