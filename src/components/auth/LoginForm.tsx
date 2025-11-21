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
}
export const LoginForm: React.FC<LoginFormProps> = ({
  email,
  password,
  loading,
  setEmail,
  setPassword,
  onSubmit
}) => {
  return <Card className="bg-transparent border-white/20 shadow-none" style={{ background: 'transparent' }}>
      <CardHeader className="bg-transparent" style={{ background: 'transparent' }}>
        <CardTitle className="text-white text-center">Iniciar Sesión</CardTitle>
        <CardDescription className="text-white/80">Ingresa tus credenciales para acceder a tu cuenta.</CardDescription>
      </CardHeader>
      <CardContent className="bg-transparent" style={{ background: 'transparent' }}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-login" className="text-white">Email</Label>
            <Input id="email-login" type="email" placeholder="m@example.com" required value={email} onChange={e => setEmail(e.target.value)} className="bg-transparent border-white/50 text-white placeholder-white/60 focus:border-white" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password-login" className="text-white">Contraseña</Label>
            <Input id="password-login" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="bg-transparent border-white/50 text-white focus:border-white" />
          </div>
          <Button type="submit" disabled={loading} className="w-full text-white font-semibold bg-transparent border-white/50 hover:bg-white/10" style={{ background: 'transparent' }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>
      </CardContent>
    </Card>;
};