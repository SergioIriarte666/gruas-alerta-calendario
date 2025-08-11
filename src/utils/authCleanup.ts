
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Auth cleanup utility to prevent limbo states during authentication
 */
export const cleanupAuthState = () => {
  console.log("Cleaning up auth state from localStorage and sessionStorage...");
  
  // Remove all Supabase auth keys from localStorage
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.startsWith('sb-')) {
      localStorage.removeItem(key);
    }
  });
  
  // Remove from sessionStorage if in use
  if (typeof sessionStorage !== 'undefined') {
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.startsWith('sb-')) {
        sessionStorage.removeItem(key);
      }
    });
  }
};

export const performGlobalSignOut = async (supabase: SupabaseClient<any, "public", any>) => {
  try {
    console.log("Performing global sign out...");
    await supabase.auth.signOut({ scope: 'global' });
  } catch (err) {
    // Continue even if this fails
    console.warn('Global sign out failed:', err);
  }
};

/**
 * Verifies if the current session is consistent between frontend and backend
 */
export const verifySessionConsistency = async (supabase: SupabaseClient<any, "public", any>) => {
  try {
    console.log("Verifying session consistency...");
    
    // Check frontend session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("Error getting session:", sessionError);
      return { isValid: false, reason: 'session_error', error: sessionError };
    }

    if (!session || !session.user) {
      console.log("No session found");
      return { isValid: false, reason: 'no_session' };
    }

    // Test backend session by querying auth.uid()
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (error && error.message.includes('JWT')) {
      console.error("JWT token invalid:", error);
      return { isValid: false, reason: 'invalid_jwt', error };
    }

    if (error && error.code === 'PGRST116') {
      console.error("RLS policy failed - likely auth.uid() is NULL:", error);
      return { isValid: false, reason: 'auth_uid_null', error };
    }

    console.log("Session verification successful");
    return { isValid: true, session };
    
  } catch (error) {
    console.error("Error verifying session consistency:", error);
    return { isValid: false, reason: 'verification_error', error };
  }
};

/**
 * Forces a complete re-authentication by cleaning state and redirecting
 */
export const forceReAuthentication = async (supabase: SupabaseClient<any, "public", any>) => {
  console.log("Forcing re-authentication...");
  
  try {
    // Step 1: Complete cleanup
    cleanupAuthState();
    
    // Step 2: Global sign out
    await performGlobalSignOut(supabase);
    
    // Step 3: Force page reload to auth
    window.location.href = '/auth?forced=true';
  } catch (error) {
    console.error("Error during forced re-authentication:", error);
    // Force reload anyway
    window.location.href = '/auth?forced=true';
  }
};
