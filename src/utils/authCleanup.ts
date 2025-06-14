
/**
 * Auth cleanup utility to prevent limbo states during authentication
 */
export const cleanupAuthState = () => {
  // Remove standard auth tokens
  localStorage.removeItem('supabase.auth.token');
  
  // Remove all Supabase auth keys from localStorage
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      localStorage.removeItem(key);
    }
  });
  
  // Remove from sessionStorage if in use
  if (typeof sessionStorage !== 'undefined') {
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        sessionStorage.removeItem(key);
      }
    });
  }
};

export const performGlobalSignOut = async (supabase: any) => {
  try {
    await supabase.auth.signOut({ scope: 'global' });
  } catch (err) {
    // Continue even if this fails
    console.warn('Global sign out failed:', err);
  }
};
