
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const { user: profileUser } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (authUser && profileUser) {
      if (profileUser.role === 'operator') {
        navigate('/operator', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [authUser, profileUser, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: 'Error al iniciar sesión', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Inicio de sesión exitoso', description: '¡Bienvenido de vuelta!' });
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      toast({ title: 'Error en el registro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Registro exitoso', description: 'Por favor, revisa tu correo para confirmar tu cuenta.' });
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <Tabs defaultValue="login" className="w-[400px]">
        <TabsList className="grid w-full grid-cols-2 bg-black/20 text-white">
          <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
          <TabsTrigger value="register">Registrarse</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="text-white">Iniciar Sesión</CardTitle>
              <CardDescription>Ingresa tus credenciales para acceder a tu cuenta.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-login" className="text-gray-300">Email</Label>
                  <Input id="email-login" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-white/5 border-gray-700 text-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-login" className="text-gray-300">Contraseña</Label>
                  <Input id="password-login" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="bg-white/5 border-gray-700 text-white" />
                </div>
                <Button type="submit" className="w-full bg-tms-green hover:bg-tms-green-dark text-white" disabled={loading}>
                  {loading ? 'Ingresando...' : 'Ingresar'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="register">
           <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="text-white">Registrarse</CardTitle>
              <CardDescription>Crea una nueva cuenta para empezar.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-register" className="text-gray-300">Email</Label>
                  <Input id="email-register" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-white/5 border-gray-700 text-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-register" className="text-gray-300">Contraseña</Label>
                  <Input id="password-register" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="bg-white/5 border-gray-700 text-white" />
                </div>
                <Button type="submit" className="w-full bg-tms-green hover:bg-tms-green-dark text-white" disabled={loading}>
                  {loading ? 'Registrando...' : 'Registrar'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Auth;
