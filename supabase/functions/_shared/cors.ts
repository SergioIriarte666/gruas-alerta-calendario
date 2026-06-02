const STANDARD = 'authorization, x-client-info, apikey, content-type';
const WITH_SDK_INFO =
  `${STANDARD}, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version`;

/**
 * Returns per-request CORS headers that reflect the caller's origin only when it matches
 * the configured ALLOWED_ORIGIN env var (or any localhost origin in development).
 * Falls back to the configured production origin, or '*' if none is set.
 */
export function getCorsHeaders(
  req: Request,
  allowHeaders = STANDARD,
): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  let allowedOrigin: string;
  if (isLocalhost) {
    allowedOrigin = origin || '*';
  } else {
    const configured = Deno.env.get('ALLOWED_ORIGIN') ?? '';
    allowedOrigin = configured && origin === configured ? origin : (configured || '*');
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': allowHeaders,
  };
}

/** Legacy wildcard constant for non-sensitive endpoints. */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': STANDARD,
};

/** For functions that receive Supabase SDK client-info headers in preflight. */
export const corsHeadersExtended: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': WITH_SDK_INFO,
};
