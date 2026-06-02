
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from "@/lib/logger";


const logger = createLogger("authUtils");
export const debugAuthState = async () => {
  try {
    logger.debug('=== AUTH STATE DEBUG ===');
    
    // Check current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    logger.debug('Current session:', session ? 'exists' : 'null');
    logger.debug('Session error:', sessionError);
    
    if (session?.user) {
      logger.debug('Auth user ID:', session.user.id);
      logger.debug('Auth user email:', session.user.email);
      
      // Check if profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      logger.debug('Profile data:', profile);
      logger.debug('Profile error:', profileError);
      
      if (profileError && profileError.code === 'PGRST116') {
        logger.debug('Profile does not exist - needs to be created');
      }
    }
    
    logger.debug('=== END AUTH DEBUG ===');
    
    return {
      hasSession: !!session,
      hasUser: !!session?.user,
      hasProfile: !sessionError && !!session?.user,
      sessionError,
    };
  } catch (error) {
    logger.error('Auth debug failed:', error);
    return {
      hasSession: false,
      hasUser: false,
      hasProfile: false,
      sessionError: error,
    };
  }
};

export const recoverAuthState = async () => {
  try {
    logger.debug('Attempting auth state recovery...');
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      logger.debug('No session found, cannot recover');
      return false;
    }
    
    // Try to create profile if it doesn't exist
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .single();
      
    if (!existingProfile) {
      logger.debug('Creating missing profile...');
      
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: session.user.id,
          email: session.user.email || '',
          full_name: session.user.email || 'Usuario',
          role: 'viewer'
        })
        .select()
        .single();
        
      if (createError) {
        logger.error('Failed to create profile:', createError);
        return false;
      }
      
      logger.debug('Profile created successfully:', newProfile);
      return true;
    }
    
    logger.debug('Profile already exists');
    return true;
  } catch (error) {
    logger.error('Auth recovery failed:', error);
    return false;
  }
};
