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
  return <Card className="auth-native-card rounded-3xl border-auth-border/15 bg-auth-surface/10 shadow-2xl backdrop-blur-xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-center text-xl text-auth-foreground">
          Iniciar Sesión
        </CardTitle>
        <CardDescription className="text-center text-auth-muted">
          Ingresa tus credenciales para acceder a tu cuenta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-login" className="text-auth-muted">Email</Label>
            <Input id="email-login" type="email" inputMode="email" autoComplete="email" placeholder="nombre@empresa.cl" required value={email} onChange={e => setEmail(e.target.value)} className="h-12 rounded-2xl border-auth-input-border bg-auth-input px-4 text-base text-auth-input-foreground placeholder:text-auth-input-muted focus:border-auth-input-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password-login" className="text-auth-muted">Contraseña</Label>
            <Input id="password-login" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="h-12 rounded-2xl border-auth-input-border bg-auth-input px-4 text-base text-auth-input-foreground placeholder:text-auth-input-muted focus:border-auth-input-border" />
          </div>
          {onForgotPassword && (
            <div className="text-right">
              <button
                type="button"
                onClick={onForgotPassword}
                className="inline-flex min-h-11 items-center px-1 text-sm text-auth-muted underline underline-offset-2 transition-colors hover:text-auth-foreground"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}
          <Button type="submit" disabled={loading || isBlocked} className="h-12 w-full rounded-2xl bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90">
            {isBlocked ? `Espera ${remainingSeconds}s...` : loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
          {isBlocked && (
            <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-auth-danger" />
              <p className="text-sm text-auth-danger">
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
