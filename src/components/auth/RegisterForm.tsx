
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
  return (
    <Card className="bg-white/15 backdrop-blur-md border border-white/20 shadow-2xl">
      <CardHeader>
        <CardTitle className="text-white">Registrarse</CardTitle>
        <CardDescription className="text-white/80">Crea una nueva cuenta para empezar.</CardDescription>
      </CardHeader>
      <CardContent className="bg-transparent">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-register" className="text-white">Email</Label>
            <Input
              id="email-register"
              type="email"
              placeholder="m@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/20 border-white/30 text-white placeholder-white/60 focus:bg-white/30 focus:border-white/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password-register" className="text-white">Contraseña</Label>
            <Input
              id="password-register"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white/20 border-white/30 text-white focus:bg-white/30 focus:border-white/50"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-tms-green hover:bg-tms-green-dark text-black font-semibold shadow-lg"
            disabled={loading}
          >
            {loading ? 'Registrando...' : 'Registrar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
