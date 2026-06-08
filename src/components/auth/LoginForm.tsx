import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

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
        <CardTitle className="text-center text-2xl text-white">Iniciar Sesión</CardTitle>
        <CardDescription className="text-center text-white/70">Ingresa tus credenciales para acceder a tu cuenta.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-login" className="text-white/85">Email</Label>
            <Input id="email-login" type="email" placeholder="m@example.com" required value={email} onChange={e => setEmail(e.target.value)} className="h-11 rounded-xl border-white/15 bg-white/8 text-white placeholder:text-white/45 focus:border-white/40" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password-login" className="text-white/85">Contraseña</Label>
            <Input id="password-login" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="h-11 rounded-xl border-white/15 bg-white/8 text-white focus:border-white/40" />
          </div>
          {onForgotPassword && (
            <div className="text-right">
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-sm text-white/70 hover:text-white underline underline-offset-2 transition-colors"
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
          <>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/15" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-transparent px-2 text-white/45">o</span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl border-white/15 bg-white/8 text-white hover:bg-white/15 flex items-center gap-2"
              onClick={onGoogleLogin}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continuar con Google
            </Button>
          </>
        )}
      </CardContent>
    </Card>;
};
