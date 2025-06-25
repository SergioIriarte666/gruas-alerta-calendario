
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
  
  const [email, setEmail] = useState(emailParam || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(
    (tabParam as 'login' | 'register') || (isInvited ? 'register' : 'login')
  );
  
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading } = useUser();
  const navigate = useNavigate();

  // Si viene de una invitación, mostrar mensaje y cambiar a registro
  useEffect(() => {
    if (isInvited && emailParam) {
      setActiveTab('register');
      toast.info('¡Bienvenido! Completa tu registro para acceder al sistema.', {
        duration: 5000
      });
    }
  }, [isInvited, emailParam]);

  useEffect(() => {
    // Only redirect when we have both auth user and profile user and are not loading
    if (!authLoading && !profileLoading && authUser && profileUser) {
      console.log('Redirecting authenticated user:', profileUser.role);
      
      // Forzar una redirección completa para evitar problemas de estado
      const targetPath = profileUser.role === 'client' ? '/portal' : 
                        profileUser.role === 'operator' ? '/operator' : '/dashboard';
      
      window.location.href = targetPath;
    }
  }, [authUser, profileUser, authLoading, profileLoading]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    
    try {
      console.log('Attempting login...');
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error('Login error:', error);
        toast.error('Error al iniciar sesión', {
          description: error.message
        });
      } else {
        console.log('Login successful');
        toast.success('Inicio de sesión exitoso');
        // La redirección se maneja en el useEffect
      }
    } catch (error: any) {
      console.error('Login exception:', error);
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
      console.log('Attempting signup...');
      
      // Validar que los campos estén completos
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
        console.error('Signup error:', error);
        
        // Manejar errores específicos
        if (error.message.includes('already registered')) {
          toast.error('Este email ya está registrado', {
            description: 'Intenta iniciar sesión en su lugar.'
          });
          setActiveTab('login');
        } else {
          toast.error('Error en el registro', {
            description: error.message
          });
        }
      } else {
        console.log('Signup successful:', data);
        
        if (data.user && !data.user.email_confirmed_at) {
          toast.success('Registro exitoso', {
            description: 'Por favor, revisa tu correo para confirmar tu cuenta.'
          });
        } else if (data.user) {
          toast.success('¡Registro completado exitosamente!', {
            description: 'Redirigiendo al sistema...'
          });
          // La redirección automática se maneja en el useEffect
        }
      }
    } catch (error: any) {
      console.error('Signup exception:', error);
      toast.error('Error en el registro', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth state
  if (authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-4">Verificando autenticación...</div>
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
