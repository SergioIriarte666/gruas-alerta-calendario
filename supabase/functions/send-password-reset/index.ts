
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { Resend } from "npm:resend@6";
import { getCorsHeaders } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const PASSWORD_RESET_WINDOW_MINUTES = 15;
const PASSWORD_RESET_MAX_ATTEMPTS = 3;
const PASSWORD_RESET_BLOCK_MINUTES = 30;
const GENERIC_RESET_MESSAGE = "Si el email está registrado, recibirás un correo de recuperación.";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
  });

const successResponse = () =>
  jsonResponse({ success: true, message: GENERIC_RESET_MESSAGE }, 200);

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const maskEmailForLogs = (email: string) => {
  const [localPart = "", domainPart = ""] = email.split("@");
  if (!domainPart) return "***";

  const visibleLocal = localPart.slice(0, 2);
  return `${visibleLocal}${"*".repeat(Math.max(localPart.length - visibleLocal.length, 1))}@${domainPart}`;
};

const getClientIp = (req: Request) => {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("fly-client-ip") ||
    "unknown"
  );
};

const sha256Hex = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const getTurnstileSecretKey = () =>
  Deno.env.get("TURNSTILE_SECRET_KEY") ||
  Deno.env.get("CLOUDFLARE_TURNSTILE_SECRET_KEY") ||
  "";

const verifyTurnstileToken = async (captchaToken: string, clientIp: string) => {
  const secretKey = getTurnstileSecretKey();

  if (!secretKey) {
    throw new Error("TURNSTILE_SECRET_KEY not configured");
  }

  const body = new URLSearchParams({
    secret: secretKey,
    response: captchaToken,
    remoteip: clientIp,
  });

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Turnstile siteverify failed with HTTP ${response.status}`);
  }

  const result = await response.json();
  return {
    success: Boolean(result?.success),
    errorCodes: Array.isArray(result?.["error-codes"]) ? result["error-codes"] : [],
    action: typeof result?.action === "string" ? result.action : null,
  };
};

const applyPasswordResetRateLimit = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
  clientIp: string,
) => {
  const emailHash = await sha256Hex(email);
  const ipHash = await sha256Hex(clientIp);
  const now = new Date();

  const { data: existingLimit, error: readError } = await supabaseAdmin
    .from('password_reset_rate_limits')
    .select('attempt_count, window_started_at, blocked_until')
    .eq('email_hash', emailHash)
    .eq('ip_hash', ipHash)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  if (!existingLimit) {
    const { error: insertError } = await supabaseAdmin
      .from('password_reset_rate_limits')
      .insert({
        email_hash: emailHash,
        ip_hash: ipHash,
        attempt_count: 1,
        window_started_at: now.toISOString(),
        last_attempt_at: now.toISOString(),
        blocked_until: null,
        updated_at: now.toISOString(),
      });

    if (insertError) {
      throw insertError;
    }

    return { allowed: true };
  }

  const blockedUntil = existingLimit.blocked_until ? new Date(existingLimit.blocked_until) : null;
  if (blockedUntil && blockedUntil > now) {
    await supabaseAdmin
      .from('password_reset_rate_limits')
      .update({
        last_attempt_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('email_hash', emailHash)
      .eq('ip_hash', ipHash);

    return { allowed: false };
  }

  const windowStartedAt = new Date(existingLimit.window_started_at);
  const windowExpiresAt = new Date(windowStartedAt.getTime() + PASSWORD_RESET_WINDOW_MINUTES * 60 * 1000);
  const withinCurrentWindow = windowExpiresAt > now;
  const nextAttemptCount = withinCurrentWindow ? existingLimit.attempt_count + 1 : 1;
  const shouldBlock = nextAttemptCount > PASSWORD_RESET_MAX_ATTEMPTS;

  const { error: updateError } = await supabaseAdmin
    .from('password_reset_rate_limits')
    .update({
      attempt_count: shouldBlock ? nextAttemptCount : nextAttemptCount,
      window_started_at: withinCurrentWindow ? existingLimit.window_started_at : now.toISOString(),
      last_attempt_at: now.toISOString(),
      blocked_until: shouldBlock
        ? new Date(now.getTime() + PASSWORD_RESET_BLOCK_MINUTES * 60 * 1000).toISOString()
        : null,
      updated_at: now.toISOString(),
    })
    .eq('email_hash', emailHash)
    .eq('ip_hash', ipHash);

  if (updateError) {
    throw updateError;
  }

  return { allowed: !shouldBlock };
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const { email, captchaToken } = await req.json();
    const turnstileSecretKey = getTurnstileSecretKey();
    const isTurnstileEnabled = turnstileSecretKey.length > 0;

    if (!email || typeof email !== 'string') {
      return jsonResponse({ error: "Email es requerido" }, 400);
    }
    if (isTurnstileEnabled && (!captchaToken || typeof captchaToken !== 'string')) {
      return jsonResponse({ error: "Verificación anti-bot requerida" }, 400);
    }

    // Validate email format to prevent abuse with invalid inputs
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = normalizeEmail(email);
    if (!emailRegex.test(normalizedEmail) || normalizedEmail.length > 254) {
      return jsonResponse({ error: "Formato de email inválido" }, 400);
    }

    // Use service role to generate a recovery link
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const clientIp = getClientIp(req);
    const { allowed } = await applyPasswordResetRateLimit(supabaseAdmin, normalizedEmail, clientIp);

    if (!allowed) {
      console.warn("Password reset rate limit triggered", { clientIp, email: maskEmailForLogs(normalizedEmail) });
      return successResponse();
    }

    if (isTurnstileEnabled && typeof captchaToken === 'string') {
      const captchaValidation = await verifyTurnstileToken(captchaToken, clientIp);
      if (!captchaValidation.success || (captchaValidation.action && captchaValidation.action !== 'password_reset')) {
        console.warn("Invalid Turnstile validation for password reset", {
          clientIp,
          email: maskEmailForLogs(normalizedEmail),
          errorCodes: captchaValidation.errorCodes,
          action: captchaValidation.action,
        });
        return jsonResponse({ error: "La verificación anti-bot es inválida o expiró" }, 400);
      }
    }

    // Generate recovery link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
    });

    if (linkError) {
      console.error("Error generating recovery link:", linkError);
      return successResponse();
    }

    // Build the redirect URL with the token
    const siteUrl = Deno.env.get('SITE_URL') || 'https://gruas5norte.com';
    const tokenHash = linkData.properties?.hashed_token;
    const resetUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?token=${tokenHash}&type=recovery&redirect_to=${encodeURIComponent(siteUrl + '/reset-password')}`;

    // Fetch company data for branding
    const { data: companyData } = await supabaseAdmin
      .from('company_data')
      .select('business_name, logo_url, phone, email')
      .limit(1)
      .single();

    const companyName = companyData?.business_name || 'Grúas 5 Norte';
    const companyPhone = companyData?.phone || '';
    const companyEmail = companyData?.email || '';
    const logoUrl = companyData?.logo_url || '';

    // Send branded email via Resend
    const emailResponse = await resend.emails.send({
      from: `${companyName} <noreply@gruas5norte.com>`,
      to: [normalizedEmail],
      subject: `Recuperación de contraseña - ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #1a1a2e; padding: 30px 40px; text-align: center;">
                      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 50px; margin-bottom: 10px;" />` : ''}
                      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">${companyName}</h1>
                    </td>
                  </tr>
                  
                  <!-- Body -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="color: #1a1a2e; margin: 0 0 16px 0; font-size: 20px;">Recuperación de Contraseña</h2>
                      <p style="color: #4a4a4a; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                        Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. 
                        Haz clic en el botón de abajo para crear una nueva contraseña.
                      </p>
                      
                      <!-- CTA Button -->
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="padding: 8px 0 32px 0;">
                            <a href="${resetUrl}" 
                               style="display: inline-block; background-color: #22c55e; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">
                              Restablecer Contraseña
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
                        Este enlace expirará en 1 hora por motivos de seguridad. Si no solicitaste este cambio, 
                        puedes ignorar este correo de manera segura.
                      </p>
                      
                      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                      
                      <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0;">
                        Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>
                        <a href="${resetUrl}" style="color: #22c55e; word-break: break-all;">${resetUrl}</a>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                      <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px 0;">${companyName}</p>
                      ${companyPhone ? `<p style="color: #9ca3af; font-size: 11px; margin: 0 0 4px 0;">Tel: ${companyPhone}</p>` : ''}
                      ${companyEmail ? `<p style="color: #9ca3af; font-size: 11px; margin: 0;">Email: ${companyEmail}</p>` : ''}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (emailResponse.error) {
      console.error("Error sending email via Resend:", emailResponse.error);
      return jsonResponse({ error: "Error al enviar el correo" }, 500);
    }

    console.log("Password reset email sent successfully to:", maskEmailForLogs(normalizedEmail));

    return successResponse();
  } catch (error: any) {
    console.error("Error in send-password-reset:", error);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  }
};

serve(handler);
