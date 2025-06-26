
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { AuthTabs } from '@/components/auth/AuthTabs';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get('email');
  const tabParam = searchParams.get('tab');
  const isInvited = searchParams.get('invited') === 'true';
  const isRegistered = searchParams.get('registered') === 'true';
  
  const [email, setEmail] = useState(emailParam || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(
    (tabParam as 'login' | 'register') || (isInvited ? 'register' : 'login')
  );
  
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading } = useUser();
  const navigate = useNavigate();

  // Mostrar mensajes de invitación o registro
  useEffect(() => {
    if (isInvited && emailParam) {
      setActiveTab('register');
      toast.info('¡Bienvenido! Completa tu registro para acceder al sistema.');
    }
    if (isRegistered) {
      toast.success('¡Cuenta confirmada exitosamente!');
    }
  }, [isInvited, isRegistered, emailParam]);

  // Redirigir usuarios autenticados - usar la misma lógica simple que el operador
  useEffect(() => {
    if (authLoading || profileLoading) return;
    
    if (authUser && profileUser) {
      console.log(`Auth: User authenticated with role: ${profileUser.role}`);
      
      // Redirección directa basada en rol - igual que funciona para admin@admin.com
      switch (profileUser.role) {
        case 'client':
          console.log('Auth: Redirecting client to /portal');
          navigate('/portal', { replace: true });
          break;
        case 'operator':
          console.log('Auth: Redirecting operator to /operator');
          navigate('/operator', { replace: true });
          break;
        case 'admin':
        case 'viewer':
          console.log('Auth: Redirecting admin/viewer to /dashboard');
          navigate('/dashboard', { replace: true });
          break;
        default:
          console.log('Auth: Defaulting to / for unknown role');
          navigate('/', { replace: true });
          break;
      }
    }
  }, [authUser, profileUser, authLoading, profileLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        toast.error('Error al iniciar sesión', {
          description: error.message
        });
      } else {
        toast.success('Inicio de sesión exitoso');
      }
    } catch (error: any) {
      toast.error('Error al iniciar sesión', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    
    try {
      if (!email || !password) {
        toast.error('Por favor, completa todos los campos');
        return;
      }

      if (password.length < 6) {
        toast.error('La contraseña debe tener al menos 6 caracteres');
        return;
      }
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth?registered=true`
        }
      });
      
      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Este email ya está registrado');
          setActiveTab('login');
        } else {
          toast.error('Error en el registro', {
            description: error.message
          });
        }
      } else if (data.user && !data.user.email_confirmed_at) {
        toast.success('Registro exitoso', {
          description: 'Por favor, revisa tu correo para confirmar tu cuenta.'
        });
      } else if (data.user) {
        toast.success('¡Registro completado exitosamente!');
      }
    } catch (error: any) {
      toast.error('Error en el registro', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  // Mostrar loading simple mientras se verifica la autenticación
  if (authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-4">Cargando...</div>
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <AuthBackground>
      <div className="w-[400px]">
        {isInvited && (
          <div className="mb-6 p-4 bg-tms-green/10 border border-tms-green/30 rounded-lg">
            <h3 className="text-tms-green font-semibold mb-2">¡Has sido invitado!</h3>
            <p className="text-white text-sm">
              Completa tu registro con el email <strong>{emailParam}</strong> para acceder al sistema.
            </p>
          </div>
        )}

        {isRegistered && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <h3 className="text-green-400 font-semibold mb-2">¡Cuenta confirmada!</h3>
            <p className="text-white text-sm">
              Tu cuenta ha sido confirmada exitosamente. Ya puedes iniciar sesión.
            </p>
          </div>
        )}
        
        <AuthTabs activeTab={activeTab} setActiveTab={setActiveTab} />

        {activeTab === 'login' && (
          <LoginForm
            email={email}
            password={password}
            loading={loading}
            setEmail={setEmail}
            setPassword={setPassword}
            onSubmit={handleLogin}
          />
        )}

        {activeTab === 'register' && (
          <RegisterForm
            email={email}
            password={password}
            loading={loading}
            setEmail={setEmail}
            setPassword={setPassword}
            onSubmit={handleSignUp}
          />
        )}
      </div>
    </AuthBackground>
  );
};

export default Auth;
