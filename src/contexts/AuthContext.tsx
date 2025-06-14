
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cleanupAuthState, performGlobalSignOut } from '@/utils/authCleanup';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer data fetching to prevent deadlocks
        if (event === 'SIGNED_IN') {
          setTimeout(() => {
            console.log('User signed in successfully');
          }, 0);
        }
        
        setLoading(false);
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      // Clean up existing state first
      cleanupAuthState();
      
      // Attempt global sign out to clear any existing sessions
      await performGlobalSignOut(supabase);
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        let errorMessage = error.message;
        
        // Handle specific error cases with better Spanish messages
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Credenciales inválidas. Verifica tu email y contraseña.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Tu email no ha sido confirmado. Revisa tu bandeja de entrada.';
        } else if (error.message.includes('Too many requests')) {
          errorMessage = 'Demasiados intentos. Espera un momento antes de intentar nuevamente.';
        }

        toast({
          title: "Error de autenticación",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Bienvenido",
          description: "Has iniciado sesión exitosamente.",
        });
        
        // Force page reload for clean state
        setTimeout(() => {
          window.location.href = '/';
        }, 100);
      }

      return { error };
    } catch (error: any) {
      toast({
        title: "Error de autenticación",
        description: "Ocurrió un error inesperado durante el inicio de sesión.",
        variant: "destructive",
      });
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      // Clean up existing state first
      cleanupAuthState();
      
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName || email,
          }
        }
      });

      if (error) {
        let errorMessage = error.message;
        
        // Handle specific error cases with better Spanish messages
        if (error.message.includes('Signups not allowed')) {
          errorMessage = 'Los registros están deshabilitados temporalmente. Contacta al administrador del sistema para obtener acceso.';
        } else if (error.message.includes('Password should be at least')) {
          errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
        } else if (error.message.includes('Invalid email')) {
          errorMessage = 'El formato del email no es válido.';
        } else if (error.message.includes('User already registered')) {
          errorMessage = 'Este email ya está registrado. Intenta iniciar sesión en su lugar.';
        }

        toast({
          title: "Error de registro",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Registro exitoso",
          description: "Verifica tu email para completar el registro.",
        });
      }

      return { error };
    } catch (error: any) {
      toast({
        title: "Error de registro",
        description: "Ocurrió un error inesperado durante el registro.",
        variant: "destructive",
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Clean up auth state first
      cleanupAuthState();
      
      // Attempt global sign out
      await performGlobalSignOut(supabase);
      
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión exitosamente.",
      });
      
      // Force page reload for a completely clean state
      setTimeout(() => {
        window.location.href = '/auth';
      }, 100);
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast({
        title: "Error",
        description: "No se pudo cerrar sesión completamente.",
        variant: "destructive",
      });
      
      // Force reload anyway to ensure clean state
      setTimeout(() => {
        window.location.href = '/auth';
      }, 100);
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
