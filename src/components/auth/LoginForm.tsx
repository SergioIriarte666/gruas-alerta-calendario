import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
interface LoginFormProps {
  email: string;
  password: string;
  loading: boolean;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onForgotPassword?: () => void;
}
export const LoginForm: React.FC<LoginFormProps> = ({
  email,
  password,
  loading,
  setEmail,
  setPassword,
  onSubmit,
  onForgotPassword
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
          <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>
      </CardContent>
    </Card>;
};
