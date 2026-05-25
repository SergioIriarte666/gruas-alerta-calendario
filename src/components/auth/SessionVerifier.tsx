import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { verifySessionConsistency, forceReAuthentication } from '@/utils/authCleanup';
import { useNotifications } from '@/contexts/NotificationContext';

interface SessionVerifierProps {
  checkInterval?: number; // in milliseconds, default 30 seconds
  autoRecover?: boolean; // automatically attempt session recovery
}

export const SessionVerifier = ({ 
  checkInterval = 30000, 
  autoRecover = false 
}: SessionVerifierProps) => {
  const { session, user, refreshSession } = useAuth();
  const { addNotification } = useNotifications();
  const lastCheckRef = useRef<Date | null>(null);
  const verificationStatusRef = useRef<'unknown' | 'valid' | 'invalid'>('unknown');

  const logVerificationStatus = useCallback((status: 'valid' | 'invalid', checkedAt: Date) => {
    console.log(`🔐 SessionVerifier: Status = ${status}, Last Check = ${checkedAt.toISOString()}`);
  }, []);

  const verifySession = useCallback(async () => {
    if (!session || !user) {
      verificationStatusRef.current = 'invalid';
      return;
    }

    try {
      console.log('🔍 SessionVerifier: Checking session consistency...');
      const result = await verifySessionConsistency(supabase);
      
      if (result.isValid) {
        verificationStatusRef.current = 'valid';
        console.log('✅ SessionVerifier: Session is valid');
      } else {
        verificationStatusRef.current = 'invalid';
        console.error('❌ SessionVerifier: Session invalid -', result.reason);
        
        if (result.reason === 'auth_uid_null' || result.reason === 'invalid_jwt') {
          if (autoRecover) {
            console.log('🔄 SessionVerifier: Attempting automatic session recovery...');
            try {
              await refreshSession();
              
              // Re-verify after refresh
              const retryResult = await verifySessionConsistency(supabase);
              if (!retryResult.isValid) {
                console.error('🚨 SessionVerifier: Auto-recovery failed, forcing re-auth');
                await forceReAuthentication(supabase);
              } else {
                console.log('✅ SessionVerifier: Auto-recovery successful');
                verificationStatusRef.current = 'valid';
                addNotification({
                  title: 'Sesión Recuperada',
                  message: 'La sesión se recuperó automáticamente',
                  type: 'success'
                });
              }
            } catch (error) {
              console.error('🚨 SessionVerifier: Recovery failed:', error);
              await forceReAuthentication(supabase);
            }
          } else {
            addNotification({
              title: 'Problema de Sesión Detectado',
              message: 'Tu sesión no está sincronizada. Considera actualizar la página.',
              type: 'warning'
            });
          }
        }
      }
      
      const checkedAt = new Date();
      lastCheckRef.current = checkedAt;
      logVerificationStatus(verificationStatusRef.current === 'valid' ? 'valid' : 'invalid', checkedAt);
    } catch (error) {
      console.error('🚨 SessionVerifier: Error during verification:', error);
      verificationStatusRef.current = 'invalid';
      const checkedAt = new Date();
      lastCheckRef.current = checkedAt;
      logVerificationStatus('invalid', checkedAt);
    }
  }, [session, user, autoRecover, refreshSession, addNotification, logVerificationStatus]);

  // Periodic session verification
  useEffect(() => {
    if (!session || !user) {
      return;
    }

    // Initial check
    verifySession();

    // Set up interval
    const interval = setInterval(verifySession, checkInterval);

    return () => clearInterval(interval);
  }, [session, user, checkInterval, verifySession]);

  // This component doesn't render anything - it's purely for session monitoring
  return null;
};

export default SessionVerifier;
