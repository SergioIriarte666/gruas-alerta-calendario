import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface UseSessionTimeoutOptions {
  /** Tiempo de inactividad antes de mostrar advertencia (ms) - default 25 min */
  warningTime?: number;
  /** Tiempo total antes de cerrar sesión (ms) - default 30 min */
  timeoutTime?: number;
  /** Eventos que reinician el contador de inactividad */
  activityEvents?: string[];
}

interface UseSessionTimeoutReturn {
  showWarning: boolean;
  remainingTime: number;
  totalWarningTime: number;
  extendSession: () => void;
  logout: () => void;
}

export const useSessionTimeout = ({
  warningTime = 25 * 60 * 1000, // 25 minutos
  timeoutTime = 30 * 60 * 1000, // 30 minutos
  activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
}: UseSessionTimeoutOptions = {}): UseSessionTimeoutReturn => {
  const { session, signOut } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(timeoutTime - warningTime);
  
  const lastActivityRef = useRef<number>(Date.now());
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  const totalWarningTime = timeoutTime - warningTime;

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  const handleLogout = useCallback(async () => {
    clearAllTimers();
    setShowWarning(false);
    await signOut();
  }, [clearAllTimers, signOut]);

  const startWarningCountdown = useCallback(() => {
    setShowWarning(true);
    setRemainingTime(totalWarningTime);

    // Countdown cada segundo
    countdownTimerRef.current = setInterval(() => {
      setRemainingTime(prev => {
        const newTime = prev - 1000;
        if (newTime <= 0) {
          return 0;
        }
        return newTime;
      });
    }, 1000);

    // Timer para logout automático
    logoutTimerRef.current = setTimeout(() => {
      handleLogout();
    }, totalWarningTime);
  }, [totalWarningTime, handleLogout]);

  const resetTimers = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    setRemainingTime(totalWarningTime);
    lastActivityRef.current = Date.now();

    // Solo establecer timer si hay sesión activa
    if (session) {
      warningTimerRef.current = setTimeout(() => {
        startWarningCountdown();
      }, warningTime);
    }
  }, [clearAllTimers, session, warningTime, startWarningCountdown, totalWarningTime]);

  const extendSession = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  // Detectar actividad del usuario
  useEffect(() => {
    if (!session) {
      clearAllTimers();
      setShowWarning(false);
      return;
    }

    const handleActivity = () => {
      // Solo reiniciar si no estamos en modo warning
      if (!showWarning) {
        const now = Date.now();
        // Throttle: solo actualizar si pasaron más de 5 segundos
        if (now - lastActivityRef.current > 5000) {
          lastActivityRef.current = now;
          resetTimers();
        }
      }
    };

    // Agregar listeners de actividad
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Iniciar timer inicial
    resetTimers();

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
    };
  }, [session, showWarning, activityEvents, resetTimers, clearAllTimers]);

  return {
    showWarning,
    remainingTime,
    totalWarningTime,
    extendSession,
    logout: handleLogout
  };
};
