import { useEffect, useRef, useState } from 'react';

const TURNSTILE_SCRIPT_ID = 'cloudflare-turnstile-script';
let turnstileScriptPromise: Promise<void> | null = null;

type TurnstileTheme = 'light' | 'dark' | 'auto';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: TurnstileTheme;
          action?: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const loadTurnstileScript = () => {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.turnstile) {
    return Promise.resolve();
  }

  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('No se pudo cargar Turnstile')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Turnstile'));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
};

interface TurnstileWidgetProps {
  siteKey: string;
  onTokenChange: (token: string | null) => void;
  resetKey?: number;
  theme?: TurnstileTheme;
  action?: string;
}

export const TurnstileWidget = ({
  siteKey,
  onTokenChange,
  resetKey = 0,
  theme = 'auto',
  action = 'password_reset',
}: TurnstileWidgetProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const renderWidget = async () => {
      if (!containerRef.current || !siteKey) {
        return;
      }

      onTokenChange(null);
      setLoadError(null);

      try {
        await loadTurnstileScript();
        if (!isMounted || !containerRef.current || !window.turnstile) {
          return;
        }

        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }

        containerRef.current.innerHTML = '';
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          action,
          callback: (token) => onTokenChange(token),
          'expired-callback': () => onTokenChange(null),
          'error-callback': () => {
            onTokenChange(null);
            setLoadError('No se pudo verificar que eres humano. Intenta nuevamente.');
          },
        });
      } catch (error) {
        if (!isMounted) return;
        onTokenChange(null);
        setLoadError(error instanceof Error ? error.message : 'No se pudo cargar Turnstile');
      }
    };

    renderWidget();

    return () => {
      isMounted = false;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, resetKey, theme, action, onTokenChange]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} />
      {loadError ? <p className="text-xs text-red-300">{loadError}</p> : null}
    </div>
  );
};
