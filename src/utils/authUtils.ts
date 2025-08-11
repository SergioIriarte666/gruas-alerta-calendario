
import { supabase } from '@/integrations/supabase/client';

export const debugAuthState = async () => {
  try {
    console.log('=== AUTH STATE DEBUG ===');
    
    // Check current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('Current session:', session ? 'exists' : 'null');
    console.log('Session error:', sessionError);
    
    if (session?.user) {
      console.log('Auth user ID:', session.user.id);
      console.log('Auth user email:', session.user.email);
      
      // Check if profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      console.log('Profile data:', profile);
      console.log('Profile error:', profileError);
      
      if (profileError && profileError.code === 'PGRST116') {
        console.log('Profile does not exist - needs to be created');
      }
    }
    
    console.log('=== END AUTH DEBUG ===');
    
    return {
      hasSession: !!session,
      hasUser: !!session?.user,
      hasProfile: !sessionError && !!session?.user,
      sessionError,
    };
  } catch (error) {
    console.error('Auth debug failed:', error);
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
    console.log('Attempting auth state recovery...');
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      console.log('No session found, cannot recover');
      return false;
    }
    
    // Try to create profile if it doesn't exist
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .single();
      
    if (!existingProfile) {
      console.log('Creating missing profile...');
      
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
        console.error('Failed to create profile:', createError);
        return false;
      }
      
      console.log('Profile created successfully:', newProfile);
      return true;
    }
    
    console.log('Profile already exists');
    return true;
  } catch (error) {
    console.error('Auth recovery failed:', error);
    return false;
  }
};
