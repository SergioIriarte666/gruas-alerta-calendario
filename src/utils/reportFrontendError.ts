const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const reportFrontendError = (payload: {
  componentName: string;
  errorMessage: string;
  errorStack?: string;
  url: string;
}) => {
  const fnUrl = `${SUPABASE_URL}/functions/v1/log-frontend-error`;

  return fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  });
};
