import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LogIn, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/contexts/NotificationContext';

interface QuickLoginProps {
  onLoginSuccess: () => void;
}

export const QuickLogin: React.FC<QuickLoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { addNotification } = useNotifications();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        addNotification({
          title: 'Inicio de Sesión Exitoso',
          message: `Bienvenido ${data.user.email}`,
          type: 'success'
        });
        onLoginSuccess();
      }
    } catch (error: any) {
      setError(error.message);
      addNotification({
        title: 'Error de Autenticación',
        message: error.message,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogIn className="size-5" />
          Iniciar Sesión
        </CardTitle>
        <CardDescription>
          Inicia sesión para acceder a las funciones de gestión de alertas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isLoading}
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading || !email || !password}
          >
            {isLoading ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
          </Button>
        </form>
        
        <div className="mt-4 text-sm text-muted-foreground">
          <p>Usuarios de prueba:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong>Admin:</strong> administracion@gruas5norte.cl</li>
            <li><strong>Admin:</strong> siriartev@gmail.com</li>
            <li><strong>Operador:</strong> admin@admin.com</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};