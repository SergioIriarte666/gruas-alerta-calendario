import { supabase } from '@/integrations/supabase/client';

const getFunctionUrl = (functionName: string) =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;

let vipPdfAiDisabledForSession = false;

export const isVipPdfAiDisabled = () => vipPdfAiDisabledForSession;

export const disableVipPdfAiForSession = () => {
  vipPdfAiDisabledForSession = true;
};

export const invokeEdgeFunctionJson = async <T>(functionName: string, body: Record<string, unknown>): Promise<T> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
  }

  const response = await fetch(getFunctionUrl(functionName), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '');

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : typeof payload === 'string' && payload.trim().length > 0
          ? payload
          : `Error del servidor (HTTP ${response.status})`;

    throw new Error(message);
  }

  return payload as T;
};
