import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { SessionTimeoutModal } from './SessionTimeoutModal';

interface SessionTimeoutProviderProps {
  children: React.ReactNode;
  /** Tiempo de inactividad antes de mostrar advertencia (minutos) - default 25 */
  warningMinutes?: number;
  /** Tiempo total antes de cerrar sesión (minutos) - default 30 */
  timeoutMinutes?: number;
}

export const SessionTimeoutProvider = ({
  children,
  warningMinutes = 25,
  timeoutMinutes = 30
}: SessionTimeoutProviderProps) => {
  const {
    showWarning,
    remainingTime,
    totalWarningTime,
    extendSession,
    logout
  } = useSessionTimeout({
    warningTime: warningMinutes * 60 * 1000,
    timeoutTime: timeoutMinutes * 60 * 1000
  });

  return (
    <>
      {children}
      <SessionTimeoutModal
        isOpen={showWarning}
        remainingTime={remainingTime}
        totalTime={totalWarningTime}
        onExtend={extendSession}
        onLogout={logout}
      />
    </>
  );
};
