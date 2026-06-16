import { supabase } from '@/integrations/supabase/client';

/**
 * Re-autenticación por contraseña usada en dialogs de eliminación crítica.
 */
export function useReAuth() {
  const verifyPassword = async (password: string): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) throw new Error('No se pudo obtener el email del usuario');

    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (error) throw error;
  };

  return { verifyPassword };
}
