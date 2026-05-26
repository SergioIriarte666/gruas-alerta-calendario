import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
interface RegisterFormProps {
  email: string;
  password: string;
  loading: boolean;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}
export const RegisterForm: React.FC<RegisterFormProps> = ({
  email,
  password,
  loading,
  setEmail,
  setPassword,
  onSubmit
}) => {
  return <Card className="border-white/15 bg-white/10 shadow-2xl backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-2xl text-white">Registrarse</CardTitle>
        <CardDescription className="text-white/70">Crea una nueva cuenta para empezar.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-register" className="text-white/85">Email</Label>
            <Input id="email-register" type="email" placeholder="m@example.com" required value={email} onChange={e => setEmail(e.target.value)} className="h-11 rounded-xl border-white/15 bg-white/8 text-white placeholder:text-white/45 focus:border-white/40" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password-register" className="text-white/85">Contraseña</Label>
            <Input id="password-register" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="h-11 rounded-xl border-white/15 bg-white/8 text-white focus:border-white/40" />
            <PasswordStrengthIndicator password={password} />
          </div>
          <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
            {loading ? 'Registrando...' : 'Registrar'}
          </Button>
        </form>
      </CardContent>
    </Card>;
};
