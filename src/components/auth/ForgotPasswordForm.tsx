import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ForgotPasswordFormProps {
  onBack: () => void;
}

export const ForgotPasswordForm = ({ onBack }: ForgotPasswordFormProps) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.error('Error sending reset email:', error);
        toast.error('Error al enviar el correo de recuperación');
        return;
      }

      setSent(true);
      toast.success('Correo enviado', {
        description: 'Revisa tu bandeja de entrada para restablecer tu contraseña.',
      });
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
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
            <div className="w-16 h-16 bg-tms-green/20 rounded-full flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8 text-tms-green" />
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
              <ArrowLeft className="w-4 h-4 mr-2" />
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
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent border-white/50 text-white placeholder-white/60 focus:border-white"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
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
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al inicio de sesión
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
};
