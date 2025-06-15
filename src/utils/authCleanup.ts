
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
