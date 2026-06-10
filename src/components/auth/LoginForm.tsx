import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';
import { GoogleAuthButton } from './GoogleAuthButton';

interface LoginFormProps {
  email: string;
  password: string;
  loading: boolean;
  isBlocked: boolean;
  remainingSeconds: number;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onForgotPassword?: () => void;
  onGoogleLogin?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  email,
  password,
  loading,
  isBlocked,
  remainingSeconds,
  setEmail,
  setPassword,
  onSubmit,
  onForgotPassword,
  onGoogleLogin
}) => {
  return <Card className="border-white/15 bg-white/10 shadow-2xl backdrop-blur-xl">
      <CardHeader>
        <CardTitle
          className="text-center text-2xl"
          style={{ color: 'rgba(255,255,255,0.98)' }}
        >
          Iniciar Sesión
        </CardTitle>
        <CardDescription
          className="text-center"
          style={{ color: 'rgba(255,255,255,0.82)' }}
        >
          Ingresa tus credenciales para acceder a tu cuenta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-login" style={{ color: 'rgba(255,255,255,0.9)' }}>Email</Label>
            <Input id="email-login" type="email" placeholder="m@example.com" required value={email} onChange={e => setEmail(e.target.value)} className="h-11 rounded-xl border-white/15 bg-white/8 placeholder:text-white/45 focus:border-white/40" style={{ color: 'rgba(255,255,255,0.98)' }} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password-login" style={{ color: 'rgba(255,255,255,0.9)' }}>Contraseña</Label>
            <Input id="password-login" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="h-11 rounded-xl border-white/15 bg-white/8 focus:border-white/40" style={{ color: 'rgba(255,255,255,0.98)' }} />
          </div>
          {onForgotPassword && (
            <div className="text-right">
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-sm underline underline-offset-2 transition-colors"
                style={{ color: 'rgba(255,255,255,0.82)' }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}
          <Button type="submit" disabled={loading || isBlocked} className="h-11 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
            {isBlocked ? `Espera ${remainingSeconds}s...` : loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
          {isBlocked && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-400" />
              <p className="text-sm text-red-300">
                Demasiados intentos fallidos. Podrás intentarlo de nuevo en{' '}
                <span className="font-semibold">{remainingSeconds} segundos</span>.
              </p>
            </div>
          )}
        </form>

        {onGoogleLogin && (
          <GoogleAuthButton
            label="Iniciar sesión con Google"
            onClick={onGoogleLogin}
            disabled={loading}
          />
        )}
      </CardContent>
    </Card>;
};
