import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  return <Card className="bg-transparent">
      <CardHeader>
        <CardTitle className="text-white">Registrarse</CardTitle>
        <CardDescription className="text-white/80">Crea una nueva cuenta para empezar.</CardDescription>
      </CardHeader>
      <CardContent className="bg-transparent">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-register" className="text-white">Email</Label>
            <Input id="email-register" type="email" placeholder="m@example.com" required value={email} onChange={e => setEmail(e.target.value)} className="bg-transparent border-white/50 text-white placeholder-white/60 focus:border-white" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password-register" className="text-white">Contraseña</Label>
            <Input id="password-register" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="bg-transparent border-white/50 text-white focus:border-white" />
          </div>
          <Button type="submit" disabled={loading} className="w-full text-white font-semibold bg-transparent">
            {loading ? 'Registrando...' : 'Registrar'}
          </Button>
        </form>
      </CardContent>
    </Card>;
};