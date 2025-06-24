
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
    <Card className="bg-white/95 backdrop-blur-sm border border-white/30 shadow-xl">
      <CardHeader>
        <CardTitle className="text-black">Registrarse</CardTitle>
        <CardDescription className="text-gray-600">Crea una nueva cuenta para empezar.</CardDescription>
      </CardHeader>
      <CardContent className="bg-transparent">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-register" className="text-black">Email</Label>
            <Input
              id="email-register"
              type="email"
              placeholder="m@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/90 border-gray-300 text-black placeholder-gray-500 focus:bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password-register" className="text-black">Contraseña</Label>
            <Input
              id="password-register"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white/90 border-gray-300 text-black focus:bg-white"
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
