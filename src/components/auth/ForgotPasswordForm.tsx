import { type ChangeEvent, type FormEvent, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TurnstileWidget } from './TurnstileWidget';
import { createLogger } from "@/lib/logger";


const logger = createLogger("ForgotPasswordForm");
interface ForgotPasswordFormProps {
  onBack: () => void;
}

export const ForgotPasswordForm = ({ onBack }: ForgotPasswordFormProps) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || '';
  const isTurnstileEnabled = turnstileSiteKey.length > 0;

  const handleCaptchaTokenChange = useCallback((token: string | null) => {
    setCaptchaToken(token);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (isTurnstileEnabled && !captchaToken) {
      toast.error('Completa la verificación anti-bot antes de continuar');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-password-reset', {
        body: {
          email: email.trim(),
          ...(isTurnstileEnabled && captchaToken ? { captchaToken } : {}),
        },
      });

      if (error) {
        logger.error('Error calling send-password-reset:', error);
        toast.error(error.message || 'Error al enviar el correo de recuperación');
        setCaptchaToken(null);
        setCaptchaResetKey((current: number) => current + 1);
        return;
      }

      setSent(true);
      setCaptchaToken(null);
      toast.success('Correo enviado', {
        description: 'Revisa tu bandeja de entrada para restablecer tu contraseña.',
      });
    } catch (error) {
      logger.error('Error:', error);
      toast.error('Error de conexión');
      setCaptchaToken(null);
      setCaptchaResetKey((current: number) => current + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-auth-border/15 bg-auth-surface/10 shadow-2xl backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-center text-2xl text-auth-foreground">Recuperar Contraseña</CardTitle>
        <CardDescription className="text-center text-auth-foreground/70">
          {sent
            ? 'Te hemos enviado un enlace de recuperación.'
            : 'Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/20">
              <Mail className="size-8 text-primary" />
            </div>
            <p className="text-sm text-auth-foreground/80">
              Revisa tu correo <strong className="text-auth-foreground">{email}</strong> y sigue las instrucciones para restablecer tu contraseña.
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              className="text-auth-foreground/80 hover:text-auth-foreground hover:bg-auth-surface/10"
            >
              <ArrowLeft className="size-4 mr-2" />
              Volver al inicio de sesión
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-reset" className="text-auth-foreground/85">Email</Label>
              <Input
                id="email-reset"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                className="h-11 rounded-xl border-auth-input-border bg-auth-input text-auth-input-foreground placeholder:text-auth-input-muted focus:border-auth-input-border"
              />
            </div>
            {isTurnstileEnabled ? (
              <div className="space-y-2">
                <Label className="text-auth-foreground/85">Verificación anti-bot</Label>
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  resetKey={captchaResetKey}
                  theme="dark"
                  action="password_reset"
                  onTokenChange={handleCaptchaTokenChange}
                />
              </div>
            ) : null}
            <Button
              type="submit"
              disabled={loading || (isTurnstileEnabled && !captchaToken)}
              className="h-11 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              className="w-full text-auth-foreground/80 hover:text-auth-foreground hover:bg-auth-surface/10"
            >
              <ArrowLeft className="size-4 mr-2" />
              Volver al inicio de sesión
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
};
