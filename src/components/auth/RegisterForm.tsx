import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { GoogleAuthButton } from './GoogleAuthButton';
interface RegisterFormProps {
  email: string;
  password: string;
  loading: boolean;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onGoogleLogin?: () => void;
}
export const RegisterForm: React.FC<RegisterFormProps> = ({
  email,
  password,
  loading,
  setEmail,
  setPassword,
  onSubmit,
  onGoogleLogin
}) => {
  return <Card className="auth-native-card rounded-3xl border-auth-border/15 bg-auth-surface/10 shadow-2xl backdrop-blur-xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl text-auth-foreground">
          Registrarse
        </CardTitle>
        <CardDescription className="text-auth-muted">
          Crea una nueva cuenta para empezar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-register" className="text-auth-muted">Email</Label>
            <Input id="email-register" type="email" inputMode="email" autoComplete="email" placeholder="nombre@empresa.cl" required value={email} onChange={e => setEmail(e.target.value)} className="h-12 rounded-2xl border-auth-input-border bg-auth-input px-4 text-base text-auth-input-foreground placeholder:text-auth-input-muted focus:border-auth-input-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password-register" className="text-auth-muted">Contraseña</Label>
            <Input id="password-register" type="password" autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)} className="h-12 rounded-2xl border-auth-input-border bg-auth-input px-4 text-base text-auth-input-foreground placeholder:text-auth-input-muted focus:border-auth-input-border" />
            <PasswordStrengthIndicator password={password} />
          </div>
          <Button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90">
            {loading ? 'Registrando...' : 'Registrar'}
          </Button>
        </form>

        {onGoogleLogin && (
          <GoogleAuthButton
            label="Registrarse con Google"
            onClick={onGoogleLogin}
            disabled={loading}
          />
        )}
      </CardContent>
    </Card>;
};
