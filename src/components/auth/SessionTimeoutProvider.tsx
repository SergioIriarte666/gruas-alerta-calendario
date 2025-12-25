import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { useSessionSettings } from '@/hooks/useSessionSettings';
import { SessionTimeoutModal } from './SessionTimeoutModal';

interface SessionTimeoutProviderProps {
  children: React.ReactNode;
}

export const SessionTimeoutProvider = ({
  children,
}: SessionTimeoutProviderProps) => {
  const { settings, loading } = useSessionSettings();

  const {
    showWarning,
    remainingTime,
    totalWarningTime,
    extendSession,
    logout
  } = useSessionTimeout({
    warningTime: settings.warningMinutes * 60 * 1000,
    timeoutTime: settings.timeoutMinutes * 60 * 1000,
    enabled: settings.enabled
  });

  // No mostrar nada mientras carga o si está deshabilitado
  if (loading) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      {settings.enabled && (
        <SessionTimeoutModal
          isOpen={showWarning}
          remainingTime={remainingTime}
          totalTime={totalWarningTime}
          onExtend={extendSession}
          onLogout={logout}
        />
      )}
    </>
  );
};
