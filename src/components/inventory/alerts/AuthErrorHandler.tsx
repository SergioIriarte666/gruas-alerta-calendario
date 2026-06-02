import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { verifySessionConsistency, forceReAuthentication } from '@/utils/authCleanup';
import { createLogger } from "@/lib/logger";


const logger = createLogger("AuthErrorHandler");
interface AuthErrorHandlerProps {
  onRetry?: () => void;
  children: React.ReactNode;
}

export const AuthErrorHandler = ({ onRetry, children }: AuthErrorHandlerProps) => {
  const { session, user, refreshSession } = useAuth();
  const { addNotification } = useNotifications();
  const [isVerifying, setIsVerifying] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'unknown' | 'valid' | 'invalid' | 'desync'>('unknown');

  // Enhanced detection of auth inconsistencies
  const hasAuthInconsistency = session && user && !session.user;
  const hasSessionDesync = sessionStatus === 'desync' || sessionStatus === 'invalid';

  const verifySession = async () => {
    if (!session || !user) {
      setSessionStatus('invalid');
      return;
    }

    setIsVerifying(true);
    try {
      const result = await verifySessionConsistency(supabase);
      
      if (result.isValid) {
        setSessionStatus('valid');
      } else {
        logger.error('Session verification failed:', result.reason, result.error);
        setSessionStatus('desync');
        
        if (result.reason === 'auth_uid_null' || result.reason === 'invalid_jwt') {
          addNotification({
            title: 'Sesión Desincronizada',
            message: 'Tu sesión no está sincronizada con el servidor. Es necesario volver a iniciar sesión.',
            type: 'warning'
          });
        }
      }
    } catch (error) {
      logger.error('Error verifying session:', error);
      setSessionStatus('invalid');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRefreshSession = async () => {
    try {
      await refreshSession();
      
      // Re-verify after refresh
      await verifySession();
      
      if (sessionStatus === 'valid') {
        addNotification({
          title: 'Sesión Actualizada',
          message: 'La sesión se ha actualizado correctamente',
          type: 'success'
        });
        onRetry?.();
      }
    } catch (error) {
      logger.error('Failed to refresh session:', error);
      setSessionStatus('invalid');
      addNotification({
        title: 'Error de Sesión',
        message: 'No se pudo actualizar la sesión. Será necesario iniciar sesión nuevamente.',
        type: 'error'
      });
    }
  };

  const handleForceReAuth = async () => {
    addNotification({
      title: 'Reiniciando Sesión',
      message: 'Limpiando estado y redirigiendo al login...',
      type: 'info'
    });
    
    await forceReAuthentication(supabase);
  };

  // Verify session on mount and when session changes
  useEffect(() => {
    if (session && user) {
      verifySession();
    } else if (!session && !user) {
      setSessionStatus('invalid');
    }
  }, [session, user]);

  // Enhanced logging for debugging
  useEffect(() => {
    if (hasAuthInconsistency || hasSessionDesync) {
      logger.warn('Auth issue detected:', {
        hasAuthInconsistency,
        hasSessionDesync,
        sessionStatus,
        session: !!session,
        user: !!user,
        sessionUser: !!session?.user,
        sessionExpires: session?.expires_at
      });
    }
  }, [hasAuthInconsistency, hasSessionDesync, sessionStatus, session, user]);

  // Show error UI for any auth inconsistency
  if (hasAuthInconsistency || hasSessionDesync) {
    return (
      <Alert className="mb-4 border-destructive bg-destructive/10">
        <AlertTriangle className="size-4" />
        <AlertDescription>
          <div className="flex flex-col gap-4">
            <div>
              <strong>Problema de Autenticación Detectado</strong>
              <p className="text-sm mt-1">
                {hasAuthInconsistency && "Tu sesión está inconsistente en el frontend."}
                {hasSessionDesync && " El servidor no reconoce tu sesión actual."}
                {" "}Es necesario actualizar o reiniciar la sesión.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleRefreshSession}
                variant="outline"
                size="sm"
                disabled={isVerifying}
              >
                <RefreshCw className={`size-4 mr-2 ${isVerifying ? 'animate-spin' : ''}`} />
                {isVerifying ? 'Verificando...' : 'Actualizar Sesión'}
              </Button>
              <Button
                onClick={handleForceReAuth}
                variant="destructive"
                size="sm"
              >
                <LogOut className="size-4 mr-2" />
                Reiniciar Sesión
              </Button>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
};