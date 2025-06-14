
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
        setSession(session);
        setUser(session?.user ?? null);
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
    }

    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
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
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "No se pudo cerrar sesión.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión exitosamente.",
      });
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
