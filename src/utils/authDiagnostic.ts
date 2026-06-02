import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('AuthDiagnostic');

/**
 * Comprehensive auth diagnostic utility
 */
export const runAuthDiagnostic = async () => {
  logger.debug('=== RUNNING COMPREHENSIVE AUTH DIAGNOSTIC ===');
  
  const results = {
    timestamp: new Date().toISOString(),
    supabaseConfig: {},
    sessionStatus: {},
    databaseConnectivity: {},
    rls: {},
    localStorage: {},
    errors: [] as string[]
  };

  try {
    // 1. Check Supabase configuration
    logger.debug('1. Checking Supabase configuration...');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const currentUrl = window.location.origin;
    
    results.supabaseConfig = {
      url: supabaseUrl,
      currentOrigin: currentUrl,
      urlMatch: supabaseUrl?.includes('supabase.co')
    };

    // 2. Check session status
    logger.debug('2. Checking session status...');
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      results.sessionStatus = {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        email: session?.user?.email,
        expiresAt: session?.expires_at,
        sessionError: sessionError?.message,
        isExpired: session?.expires_at ? new Date(session.expires_at * 1000) < new Date() : null
      };
      
      if (sessionError) {
        results.errors.push(`Session Error: ${sessionError.message}`);
      }
    } catch (error: any) {
      results.errors.push(`Session Check Failed: ${error.message}`);
      results.sessionStatus = { error: error.message };
    }

    // 3. Test database connectivity
    logger.debug('3. Testing database connectivity...');
    try {
      // Test basic query
      const { data: testData, error: testError } = await supabase
        .from('company_data')
        .select('id')
        .limit(1);
        
      results.databaseConnectivity = {
        canQuery: !testError,
        error: testError?.message,
        dataReceived: !!testData
      };
      
      if (testError) {
        results.errors.push(`DB Connectivity Error: ${testError.message}`);
      }
    } catch (error: any) {
      results.errors.push(`DB Test Failed: ${error.message}`);
      results.databaseConnectivity = { error: error.message };
    }

    // 4. Test RLS policies with auth.uid()
    logger.debug('4. Testing RLS policies...');
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, role')
        .limit(1);
        
      results.rls = {
        canAccessProfiles: !profileError,
        error: profileError?.message,
        errorCode: profileError?.code,
        dataReceived: !!profileData,
        authUidWorking: profileError?.code !== 'PGRST116'
      };
      
      if (profileError) {
        results.errors.push(`RLS Test Error: ${profileError.message} (Code: ${profileError.code})`);
      }
    } catch (error: any) {
      results.errors.push(`RLS Test Failed: ${error.message}`);
      results.rls = { error: error.message };
    }

    // 5. Check localStorage auth state
    logger.debug('5. Checking localStorage auth state...');
    const authKeys = [];
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('supabase.auth.') || key.startsWith('sb-'))) {
          authKeys.push({
            key,
            hasValue: !!localStorage.getItem(key),
            length: localStorage.getItem(key)?.length || 0
          });
        }
      }
    }
    
    results.localStorage = {
      authKeysFound: authKeys.length,
      keys: authKeys
    };

  } catch (error: any) {
    results.errors.push(`Diagnostic Failed: ${error.message}`);
  }

  logger.debug('=== DIAGNOSTIC RESULTS ===');
  logger.debug(JSON.stringify(results, null, 2));
  logger.debug('=== END DIAGNOSTIC ===');
  
  return results;
};

/**
 * Auto-repair common auth issues
 */
export const attemptAuthRepair = async () => {
  logger.debug('=== ATTEMPTING AUTH REPAIR ===');
  
  try {
    // Step 1: Clean localStorage
    logger.debug('1. Cleaning localStorage...');
    if (typeof localStorage !== 'undefined') {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('supabase.auth.') || key.startsWith('sb-')) {
          localStorage.removeItem(key);
          logger.debug(`Removed: ${key}`);
        }
      });
    }
    
    // Step 2: Clean sessionStorage
    logger.debug('2. Cleaning sessionStorage...');
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('supabase.auth.') || key.startsWith('sb-')) {
          sessionStorage.removeItem(key);
          logger.debug(`Removed from session: ${key}`);
        }
      });
    }
    
    // Step 3: Force sign out
    logger.debug('3. Forcing sign out...');
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (error) {
      logger.debug('Sign out error (expected):', error);
    }
    
    // Step 4: Test fresh connection
    logger.debug('4. Testing fresh connection...');
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      logger.error('Fresh connection test failed:', error);
      return { success: false, error: error.message };
    }
    
    logger.debug('=== REPAIR COMPLETED ===');
    return { 
      success: true, 
      message: 'Auth state cleaned successfully',
      hasSession: !!session
    };
    
  } catch (error: any) {
    logger.error('=== REPAIR FAILED ===', error);
    return { success: false, error: error.message };
  }
};