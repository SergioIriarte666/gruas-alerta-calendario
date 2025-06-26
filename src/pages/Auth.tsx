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
  const [redirecting, setRedirecting] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(
    (tabParam as 'login' | 'register') || (isInvited ? 'register' : 'login')
  );
  
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading, forceRefreshProfile } = useUser();
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

  // Si viene de confirmación de email
  useEffect(() => {
    if (isRegistered) {
      toast.success('¡Cuenta confirmada exitosamente!', {
        description: 'Ya puedes iniciar sesión en el sistema.'
      });
    }
  }, [isRegistered]);

  // Función mejorada para manejar redirección basada en rol
  const handleRoleBasedRedirect = async (userProfile: any) => {
    if (!userProfile || !userProfile.role) {
      console.error('Auth: No user profile or role found for redirect');
      return;
    }

    console.log(`Auth: Redirecting user with role: ${userProfile.role}`);
    console.log('Auth: Full profile data:', userProfile);
    
    // Validar que el rol sea válido
    const validRoles = ['admin', 'operator', 'viewer', 'client'];
    if (!validRoles.includes(userProfile.role)) {
      console.error('Auth: Invalid role detected:', userProfile.role);
      toast.error('Error: Rol de usuario inválido');
      return;
    }
    
    // Pequeño delay para asegurar que la UI esté lista
    await new Promise(resolve => setTimeout(resolve, 200));
    
    switch (userProfile.role) {
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
        console.error('Auth: Unknown role, redirecting to /');
        navigate('/', { replace: true });
        break;
    }
  };

  // Redirigir usuarios autenticados con lógica mejorada
  useEffect(() => {
    const handleAuthenticatedUserRedirect = async () => {
      // No hacer nada si ya estamos redirigiendo
      if (redirecting) {
        console.log('Auth: Already redirecting, skipping...');
        return;
      }

      // Esperar a que termine de cargar la autenticación
      if (authLoading) {
        console.log('Auth: Auth still loading, waiting...');
        return;
      }

      // Si no hay usuario autenticado, no hacer nada
      if (!authUser) {
        console.log('Auth: No authenticated user found');
        return;
      }

      console.log('Auth: Authenticated user found:', authUser.email);

      // Esperar a que termine de cargar el perfil
      if (profileLoading) {
        console.log('Auth: Profile still loading, waiting...');
        return;
      }

      // Si no hay perfil de usuario, forzar recarga con múltiples intentos
      if (!profileUser) {
        console.log('Auth: No profile found, forcing refresh with retries...');
        setRedirecting(true);
        
        try {
          // Primer intento de recarga
          await forceRefreshProfile();
          
          // Esperar más tiempo para que se actualice el estado
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Segundo intento si aún no tenemos perfil
          if (!profileUser) {
            console.log('Auth: First refresh attempt failed, trying again...');
            await forceRefreshProfile();
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          
          // Si aún no tenemos perfil después de múltiples intentos, hay un problema
          if (!profileUser) {
            console.error('Auth: Failed to load profile after multiple attempts');
            toast.error('Error cargando perfil de usuario', {
              description: 'Por favor, intenta cerrar sesión e iniciar sesión nuevamente.'
            });
          }
          
        } catch (error) {
          console.error('Auth: Error forcing profile refresh:', error);
        } finally {
          setRedirecting(false);
        }
        return;
      }

      // Si tenemos ambos (auth user y profile), proceder con redirección
      console.log('Auth: Both auth user and profile available, proceeding with redirect');
      console.log('Auth: Profile details for redirect:', {
        id: profileUser.id,
        email: profileUser.email,
        role: profileUser.role,
        client_id: profileUser.client_id
      });

      setRedirecting(true);
      
      try {
        await handleRoleBasedRedirect(profileUser);
      } catch (error) {
        console.error('Auth: Error during role-based redirect:', error);
        setRedirecting(false);
      }
    };

    handleAuthenticatedUserRedirect();
  }, [authUser, profileUser, authLoading, profileLoading, navigate, forceRefreshProfile, redirecting]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    
    try {
      console.log('Auth: Attempting login for:', email);
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error('Auth: Login error:', error);
        toast.error('Error al iniciar sesión', {
          description: error.message
        });
      } else {
        console.log('Auth: Login successful');
        toast.success('Inicio de sesión exitoso');
        // La redirección se maneja en el useEffect
      }
    } catch (error: any) {
      console.error('Auth: Login exception:', error);
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
      console.log('Auth: Attempting signup for:', email);
      
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
        console.error('Auth: Signup error:', error);
        
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
        console.log('Auth: Signup successful:', data);
        
        if (data.user && !data.user.email_confirmed_at) {
          toast.success('Registro exitoso', {
            description: 'Por favor, revisa tu correo para confirmar tu cuenta.'
          });
        } else if (data.user) {
          toast.success('¡Registro completado exitosamente!', {
            description: 'Redirigiendo al sistema...'
          });
          // La redirección se maneja en el useEffect
        }
      }
    } catch (error: any) {
      console.error('Auth: Signup exception:', error);
      toast.error('Error en el registro', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth state or redirecting
  if (authLoading || profileLoading || redirecting) {
    const message = redirecting 
      ? 'Redirigiendo según tu rol de usuario...' 
      : profileLoading 
        ? 'Cargando perfil de usuario...' 
        : 'Verificando autenticación...';
        
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-4">{message}</div>
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
