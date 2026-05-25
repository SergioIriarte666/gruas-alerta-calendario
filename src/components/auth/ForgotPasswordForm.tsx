import { type ChangeEvent, type FormEvent, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TurnstileWidget } from './TurnstileWidget';

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
        console.error('Error calling send-password-reset:', error);
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
      console.error('Error:', error);
      toast.error('Error de conexión');
      setCaptchaToken(null);
      setCaptchaResetKey((current: number) => current + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-transparent border-white/20 shadow-none" style={{ background: 'transparent' }}>
      <CardHeader className="bg-transparent" style={{ background: 'transparent' }}>
        <CardTitle className="text-white text-center">Recuperar Contraseña</CardTitle>
        <CardDescription className="text-white/80">
          {sent
            ? 'Te hemos enviado un enlace de recuperación.'
            : 'Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="bg-transparent" style={{ background: 'transparent' }}>
        {sent ? (
          <div className="space-y-4 text-center">
            <div className="size-16 bg-tms-green/20 rounded-full flex items-center justify-center mx-auto">
              <Mail className="size-8 text-tms-green" />
            </div>
            <p className="text-white/80 text-sm">
              Revisa tu correo <strong className="text-white">{email}</strong> y sigue las instrucciones para restablecer tu contraseña.
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="size-4 mr-2" />
              Volver al inicio de sesión
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-reset" className="text-white">Email</Label>
              <Input
                id="email-reset"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                className="bg-transparent border-white/50 text-white placeholder-white/60 focus:border-white"
              />
            </div>
            {isTurnstileEnabled ? (
              <div className="space-y-2">
                <Label className="text-white">Verificación anti-bot</Label>
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
              className="w-full text-white font-semibold bg-transparent border-white/50 hover:bg-white/10"
              style={{ background: 'transparent' }}
            >
              {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              className="w-full text-white/80 hover:text-white hover:bg-white/10"
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
