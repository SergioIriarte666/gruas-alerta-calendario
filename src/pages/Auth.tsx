
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
import { useLoginRateLimit } from '@/hooks/useLoginRateLimit';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { createLogger } from "@/lib/logger";
import { isOperatorMobileVariant } from '@/lib/appVariant';


const logger = createLogger("Auth");
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
  const errorParam = searchParams.get('error');
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(
    (tabParam as 'login' | 'register') || (isInvited ? 'register' : 'login')
  );
  
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading } = useUser();
  const { isBlocked, remainingSeconds, recordFailedAttempt, resetAttempts } = useLoginRateLimit();
  const navigate = useNavigate();
  const isOperatorMobile = isOperatorMobileVariant();
  const showSocialLogin = !isOperatorMobile;

  // Check if user needs to set password (invited user who just clicked the link)
  useEffect(() => {
    if (authUser && needsPasswordSetup && !profileLoading) {
      logger.debug('Auth: User needs to set password');
      setShowSetPassword(true);
    }
  }, [authUser, needsPasswordSetup, profileLoading]);

  // Mostrar mensajes de error OAuth
  useEffect(() => {
    if (errorParam === 'rejected') {
      toast.error('Tu cuenta ha sido rechazada. Contacta al administrador.')
    } else if (errorParam === 'not_approved') {
      toast.error('Tu cuenta aún no ha sido aprobada.')
    }
  }, [errorParam])

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
      logger.debug(`Auth: User authenticated with role: ${profileUser.role}`);
      
      // Redirección directa basada en rol
      switch (profileUser.role) {
        case 'client':
          logger.debug('Auth: Redirecting client to /portal');
          navigate('/portal', { replace: true });
          break;
        case 'operator':
          logger.debug('Auth: Redirecting operator to /operator');
          navigate('/operator', { replace: true });
          break;
        case 'admin':
          if (profileUser.operator_id) {
            logger.debug('Auth: Admin with operator profile detected, redirecting to / for portal selection');
            navigate('/', { replace: true });
            break;
          }
          logger.debug('Auth: Redirecting admin to /dashboard');
          navigate('/dashboard', { replace: true });
          break;
        case 'viewer':
          logger.debug('Auth: Redirecting admin/viewer to /dashboard');
          navigate('/dashboard', { replace: true });
          break;
        default:
          logger.debug('Auth: Defaulting to / for unknown role');
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

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
    if (error) {
      logger.error('Google OAuth error:', error.message)
      toast.error('Error al iniciar sesión con Google')
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (isBlocked) {
      toast.error(`Demasiados intentos fallidos. Espera ${remainingSeconds} segundos para intentarlo de nuevo.`);
      return;
    }

    setLoading(true);

    try {
      logger.debug('🔑 Auth: Starting login for:', email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      logger.debug('🔑 Auth: Login response:', { data: !!data, error: !!error });

      if (error) {
        logger.error('🚨 Auth: Login error:', error);

        recordFailedAttempt();

        // Generic error messages to prevent account enumeration
        let errorMessage = 'Credenciales inválidas';

        if (error.message.includes('Too many requests')) {
          errorMessage = 'Demasiados intentos. Espera unos minutos.';
        } else if (error.message.includes('fetch') || error.message.includes('network')) {
          errorMessage = 'Error de conexión. Verifica tu internet.';
        }

        toast.error(errorMessage);
      } else if (data?.user) {
        logger.debug('✅ Auth: Login successful for user:', data.user.email);
        resetAttempts();
        toast.success('¡Inicio de sesión exitoso!');
        // La redirección se maneja en el useEffect
      }
    } catch (error: any) {
      logger.error('🚨 Auth: Critical login error:', error);

      // Network/CORS errors are not credential failures — don't penalize the counter
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
      <div className="flex h-screen items-center justify-center bg-auth-background text-auth-foreground">
        <div className="text-center">
          <div className="mb-4">Cargando acceso...</div>
          <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-auth-border/15 bg-auth-surface/10">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  // Show set password form for invited users
  if (showSetPassword) {
    return (
      <AuthBackground variant={isOperatorMobile ? 'operator' : 'default'}>
        <div className="w-full max-w-md">
          <SetPasswordForm onSuccess={handlePasswordSetupSuccess} />
        </div>
      </AuthBackground>
    );
  }

  if (showForgotPassword) {
    return (
      <AuthBackground variant={isOperatorMobile ? 'operator' : 'default'}>
        <div className="w-full max-w-md">
          <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
        </div>
      </AuthBackground>
    );
  }

  return (
    <AuthBackground variant={isOperatorMobile ? 'operator' : 'default'}>
      <div className={`space-y-4 ${isOperatorMobile ? 'operator-auth-panel' : ''}`}>
        <div className="space-y-2 text-center">
          <Badge
            variant="outline"
            className="border-auth-border/15 bg-auth-surface/10 px-3 py-1 text-auth-muted"
          >
            {isOperatorMobile ? <ShieldCheck className="mr-1 size-3.5" /> : <Sparkles className="mr-1 size-3.5" />}
            {isOperatorMobile ? 'Acceso de terreno' : 'Acceso seguro'}
          </Badge>
          {isOperatorMobile && (
            <img src="/logo-gruas-5-norte.png" alt="Grúas 5 Norte" className="mx-auto h-16 w-auto object-contain" />
          )}
          <h1 className={`${isOperatorMobile ? 'operator-native-display text-4xl font-bold' : 'text-3xl font-semibold tracking-tight'} text-auth-foreground drop-shadow-md`}>
            {isOperatorMobile ? 'Tu jornada empieza aquí' : 'Towing Manager Software'}
          </h1>
          <p className="mx-auto max-w-sm text-sm text-auth-muted drop-shadow-sm">
            {isOperatorMobile
              ? 'Servicios, inspecciones y ruta en una sola aplicación.'
              : 'Accede a la operación, clientes y facturación desde una interfaz unificada.'}
          </p>
        </div>

      <div className="w-full max-w-md mx-auto">
        {isInvited && !needsPasswordSetup && (
          <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/10 p-4">
            <h3 className="mb-2 font-semibold text-primary">¡Has sido invitado!</h3>
            <p className="text-sm text-auth-foreground/95">
              Completa tu registro con el email <strong>{emailParam}</strong> para acceder al sistema.
            </p>
          </div>
        )}

        {isRegistered && (
          <div className="mb-6 rounded-2xl border border-success/20 bg-success/10 p-4">
            <h3 className="mb-2 font-semibold text-auth-success">¡Cuenta confirmada!</h3>
            <p className="text-sm text-auth-foreground/95">
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
            isBlocked={isBlocked}
            remainingSeconds={remainingSeconds}
            setEmail={setEmail}
            setPassword={setPassword}
            onSubmit={handleLogin}
            onForgotPassword={() => setShowForgotPassword(true)}
            onGoogleLogin={showSocialLogin ? handleGoogleLogin : undefined}
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
            onGoogleLogin={showSocialLogin ? handleGoogleLogin : undefined}
          />
        )}
      </div>
      </div>
    </AuthBackground>
  );
};

export default Auth;
