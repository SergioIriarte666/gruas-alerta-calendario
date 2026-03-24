import { useCallback, useEffect, useState } from 'react';
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
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'unknown' | 'valid' | 'invalid'>('unknown');

  const verifySession = useCallback(async () => {
    if (!session || !user) {
      setVerificationStatus('invalid');
      return;
    }

    try {
      console.log('🔍 SessionVerifier: Checking session consistency...');
      const result = await verifySessionConsistency(supabase);
      
      if (result.isValid) {
        setVerificationStatus('valid');
        console.log('✅ SessionVerifier: Session is valid');
      } else {
        setVerificationStatus('invalid');
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
                setVerificationStatus('valid');
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
      
      setLastCheck(new Date());
    } catch (error) {
      console.error('🚨 SessionVerifier: Error during verification:', error);
      setVerificationStatus('invalid');
    }
  }, [session, user, autoRecover, refreshSession, addNotification]);

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

  // Log verification status for debugging
  useEffect(() => {
    if (verificationStatus !== 'unknown') {
      console.log(`🔐 SessionVerifier: Status = ${verificationStatus}, Last Check = ${lastCheck?.toISOString()}`);
    }
  }, [verificationStatus, lastCheck]);

  // This component doesn't render anything - it's purely for session monitoring
  return null;
};

export default SessionVerifier;
