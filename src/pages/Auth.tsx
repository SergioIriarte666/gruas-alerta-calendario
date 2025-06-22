
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/custom-toast';
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
  const {
    user: profileUser,
    loading: profileLoading,
    error: profileError,
    retryFetchProfile,
    forceRefreshProfile
  } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    console.log('Auth: State check -', {
      authLoading,
      profileLoading,
      hasAuthUser: !!authUser,
      hasProfileUser: !!profileUser,
      profileRole: profileUser?.role,
      profileError
    });

    // Solo redirigir cuando tengamos usuario completo (auth + perfil) y no estemos cargando
    if (!authLoading && !profileLoading && authUser && profileUser) {
      console.log('Auth: Usuario completamente cargado, redirigiendo...', {
        role: profileUser.role,
        destination: profileUser.role === 'operator' ? '/operator' : '/dashboard'
      });
      
      if (profileUser.role === 'operator') {
        navigate('/operator', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [authUser, profileUser, authLoading, profileLoading, navigate, profileError]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      console.log('Auth: Starting login process...');
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error('Auth: Login error:', error.message);
        toast({
          type: 'error',
          title: 'Error al iniciar sesión',
          description: error.message
        });
      } else if (data.user) {
        console.log('Auth: Login successful, user ID:', data.user.id);
        // Forzar refresco del perfil tras login exitoso
        setTimeout(() => {
          forceRefreshProfile();
        }, 500);
        
        toast({
          type: 'success',
          title: 'Inicio de sesión exitoso',
          description: '¡Bienvenido de vuelta!'
        });
      }
    } catch (error: any) {
      console.error('Auth: Unexpected login error:', error.message);
      toast({
        type: 'error',
        title: 'Error al iniciar sesión',
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });
      
      if (error) {
        toast({
          type: 'error',
          title: 'Error en el registro',
          description: error.message
        });
      } else {
        toast({
          type: 'info',
          title: 'Registro exitoso',
          description: 'Por favor, revisa tu correo para confirmar tu cuenta.'
        });
      }
    } catch (error: any) {
      toast({
        type: 'error',
        title: 'Error en el registro',
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  // Si hay error en el perfil, mostrar opción de debug
  if (authUser && profileError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white" style={{ background: '#ffffff' }}>
        <Card className="border border-gray-200 w-[400px] bg-white" style={{ background: '#ffffff', borderColor: '#d1d5db' }}>
          <CardHeader>
            <CardTitle className="text-black">Error de Perfil</CardTitle>
            <CardDescription className="text-red-600">{profileError}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 bg-white" style={{ background: '#ffffff' }}>
            <div className="text-sm text-gray-600">
              <p>Usuario autenticado: {authUser.email}</p>
              <p>ID: {authUser.id}</p>
            </div>
            <div className="space-y-2">
              <Button
                onClick={retryFetchProfile}
                className="w-full bg-tms-green hover:bg-tms-green-dark text-black"
              >
                Reintentar Cargar Perfil
              </Button>
              <Button
                onClick={forceRefreshProfile}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                Forzar Refresco de Perfil
              </Button>
              <Button
                onClick={() => {
                  cleanupAuthState();
                  window.location.reload();
                }}
                variant="outline"
                className="w-full bg-white text-black border-gray-300"
              >
                Limpiar Sesión y Reiniciar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-white" style={{ background: '#ffffff' }}>
      <div className="w-[400px]">
        {/* Custom Tab Implementation */}
        <div className="flex w-full bg-gray-100 rounded-lg p-1 mb-4" style={{ background: '#f3f4f6' }}>
          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'login'
                ? 'bg-white text-black shadow-sm'
                : 'text-gray-700 hover:text-black'
            }`}
            style={activeTab === 'login' ? { background: '#ffffff', color: '#000000' } : { color: '#374151' }}
          >
            Iniciar Sesión
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'register'
                ? 'bg-white text-black shadow-sm'
                : 'text-gray-700 hover:text-black'
            }`}
            style={activeTab === 'register' ? { background: '#ffffff', color: '#000000' } : { color: '#374151' }}
          >
            Registrarse
          </button>
        </div>

        {/* Login Tab Content */}
        {activeTab === 'login' && (
          <Card className="bg-white border border-gray-200" style={{ background: '#ffffff', borderColor: '#d1d5db' }}>
            <CardHeader>
              <CardTitle className="text-black">Iniciar Sesión</CardTitle>
              <CardDescription className="text-gray-600">Ingresa tus credenciales para acceder a tu cuenta.</CardDescription>
            </CardHeader>
            <CardContent className="bg-white" style={{ background: '#ffffff' }}>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-login" className="text-black">Email</Label>
                  <Input
                    id="email-login"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white border-gray-300 text-black placeholder-gray-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-login" className="text-black">Contraseña</Label>
                  <Input
                    id="password-login"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white border-gray-300 text-black"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-tms-green hover:bg-tms-green-dark text-black"
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
          <Card className="bg-white border border-gray-200" style={{ background: '#ffffff', borderColor: '#d1d5db' }}>
            <CardHeader>
              <CardTitle className="text-black">Registrarse</CardTitle>
              <CardDescription className="text-gray-600">Crea una nueva cuenta para empezar.</CardDescription>
            </CardHeader>
            <CardContent className="bg-white" style={{ background: '#ffffff' }}>
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-register" className="text-black">Email</Label>
                  <Input
                    id="email-register"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white border-gray-300 text-black placeholder-gray-500"
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
                    className="bg-white border-gray-300 text-black"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-tms-green hover:bg-tms-green-dark text-black"
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
