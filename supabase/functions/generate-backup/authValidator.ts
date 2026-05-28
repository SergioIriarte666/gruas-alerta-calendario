
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface AuthResult {
  user: any;
  isAdmin: boolean;
}

export class AuthValidator {
  constructor(private supabase: SupabaseClient) {}

  async validateRequest(authHeader: string | null): Promise<AuthResult> {
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    // Verify user is authenticated
    const { data: { user }, error: authError } = await this.supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Usuario no autenticado');
    }

    // Verify user is admin via the authoritative user_roles table (matches RLS source of truth)
    const { data: roleRow, error: roleError } = await this.supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleRow) {
      throw new Error('Solo los administradores pueden generar respaldos');
    }

    return {
      user,
      isAdmin: true
    };
  }
}
