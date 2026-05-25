
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
import { SetPasswordForm } from '@/components/auth/SetPasswordForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { validatePassword } from '@/utils/passwordValidation';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get('email');
  const tabParam = searchParams.get('tab');
  const isInvited = searchParams.get('invited') === 'true';
  const isRegistered = searchParams.get('registered') === 'true';
  const needsPasswordSetup = searchParams.get('setup_password') === 'true';
  
  const [email, setEmail] = useState(emailParam || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(
    (tabParam as 'login' | 'register') || (isInvited ? 'register' : 'login')
  );
  
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading } = useUser();
  const navigate = useNavigate();

  // Check if user needs to set password (invited user who just clicked the link)
  useEffect(() => {
    if (authUser && needsPasswordSetup && !profileLoading) {
      console.log('Auth: User needs to set password');
      setShowSetPassword(true);
    }
  }, [authUser, needsPasswordSetup, profileLoading]);

  // Mostrar mensajes de invitación o registro
  useEffect(() => {
    if (isInvited && emailParam && !needsPasswordSetup) {
      setActiveTab('register');
      toast.info('¡Bienvenido! Completa tu registro para acceder al sistema.');
    }
    if (isRegistered) {
      toast.success('¡Cuenta confirmada exitosamente!');
    }
  }, [isInvited, isRegistered, emailParam, needsPasswordSetup]);

  // Redirigir usuarios autenticados - pero solo si no necesitan configurar contraseña
  useEffect(() => {
    if (authLoading || profileLoading) return;
    
    // Si el usuario necesita configurar contraseña, no redirigir
    if (showSetPassword) return;
    
    if (authUser && profileUser) {
      console.log(`Auth: User authenticated with role: ${profileUser.role}`);
      
      // Redirección directa basada en rol
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
  }, [authUser, profileUser, authLoading, profileLoading, navigate, showSetPassword]);

  const handlePasswordSetupSuccess = () => {
    setShowSetPassword(false);
    // Clear the URL params and let the normal redirect logic handle it
    navigate('/auth', { replace: true });
    // Force a profile refresh to trigger redirect
    window.location.reload();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    
    try {
      console.log('🔑 Auth: Starting login for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });
      
      console.log('🔑 Auth: Login response:', { data: !!data, error: !!error });
      
      if (error) {
        console.error('🚨 Auth: Login error:', error);
        
        // Generic error messages to prevent account enumeration
        let errorMessage = 'Credenciales inválidas';
        
        if (error.message.includes('Too many requests')) {
          errorMessage = 'Demasiados intentos. Espera unos minutos.';
        } else if (error.message.includes('fetch') || error.message.includes('network')) {
          errorMessage = 'Error de conexión. Verifica tu internet.';
        }
        
        toast.error(errorMessage);
      } else if (data?.user) {
        console.log('✅ Auth: Login successful for user:', data.user.email);
        toast.success('¡Inicio de sesión exitoso!');
        // La redirección se maneja en el useEffect
      }
    } catch (error: any) {
      console.error('🚨 Auth: Critical login error:', error);
      
      let errorMessage = 'Error de conexión';
      if (error.message?.includes('fetch') || error.message?.includes('network')) {
        errorMessage = 'No se puede conectar al servidor. Verifica tu internet.';
      } else if (error.message?.includes('CORS')) {
        errorMessage = 'Error de configuración del servidor.';
      }
      
      toast.error(errorMessage);
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

      // Validate password strength
      const validation = validatePassword(password);
      if (!validation.valid) {
        toast.error(validation.error);
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
          <div className="size-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // Show set password form for invited users
  if (showSetPassword) {
    return (
      <AuthBackground>
        <div className="w-full max-w-[400px]">
          <SetPasswordForm onSuccess={handlePasswordSetupSuccess} />
        </div>
      </AuthBackground>
    );
  }

  if (showForgotPassword) {
    return (
      <AuthBackground>
        <div className="w-full max-w-[400px]">
          <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
        </div>
      </AuthBackground>
    );
  }

  return (
    <AuthBackground>
      <div className="w-full max-w-[400px]">
        {isInvited && !needsPasswordSetup && (
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
            onForgotPassword={() => setShowForgotPassword(true)}
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
