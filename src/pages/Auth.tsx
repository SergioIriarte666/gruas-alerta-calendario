
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cleanupAuthState, performGlobalSignOut } from '@/utils/authCleanup';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const { user: authUser, session, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !profileLoading && authUser && profileUser) {
        if (profileUser.role === 'operator') {
            navigate('/operator', { replace: true });
        } else {
            navigate('/', { replace: true });
        }
    }
  }, [authUser, profileUser, authLoading, profileLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    cleanupAuthState();
    await performGlobalSignOut(supabase);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error('Error al iniciar sesión', { description: error.message });
    } else {
      toast.success('Inicio de sesión exitoso', { description: '¡Bienvenido de vuelta!' });
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    cleanupAuthState();
    await performGlobalSignOut(supabase);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      toast.error('Error en el registro', { description: error.message });
    } else {
      toast.info('Registro exitoso', { description: 'Por favor, revisa tu correo para confirmar tu cuenta.' });
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="w-[400px]">
        {/* Custom Tab Implementation */}
        <div className="flex w-full bg-black/20 rounded-lg p-1 mb-4">
          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'login'
                ? 'bg-white text-gray-900'
                : 'text-white hover:text-gray-300'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'register'
                ? 'bg-white text-gray-900'
                : 'text-white hover:text-gray-300'
            }`}
          >
            Registrarse
          </button>
        </div>

        {/* Login Tab Content */}
        {activeTab === 'login' && (
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="text-white">Iniciar Sesión</CardTitle>
              <CardDescription>Ingresa tus credenciales para acceder a tu cuenta.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-login" className="text-gray-300">Email</Label>
                  <Input 
                    id="email-login" 
                    type="email" 
                    placeholder="m@example.com" 
                    required 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="bg-white/5 border-gray-700 text-white" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-login" className="text-gray-300">Contraseña</Label>
                  <Input 
                    id="password-login" 
                    type="password" 
                    required 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="bg-white/5 border-gray-700 text-white" 
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-tms-green hover:bg-tms-green-dark text-white" 
                  disabled={loading}
                >
                  {loading ? 'Ingresando...' : 'Ingresar'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Register Tab Content */}
        {activeTab === 'register' && (
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="text-white">Registrarse</CardTitle>
              <CardDescription>Crea una nueva cuenta para empezar.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-register" className="text-gray-300">Email</Label>
                  <Input 
                    id="email-register" 
                    type="email" 
                    placeholder="m@example.com" 
                    required 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="bg-white/5 border-gray-700 text-white" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-register" className="text-gray-300">Contraseña</Label>
                  <Input 
                    id="password-register" 
                    type="password" 
                    required 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="bg-white/5 border-gray-700 text-white" 
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-tms-green hover:bg-tms-green-dark text-white" 
                  disabled={loading}
                >
                  {loading ? 'Registrando...' : 'Registrar'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Auth;
