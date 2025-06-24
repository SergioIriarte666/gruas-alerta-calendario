
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/custom-toast';
import { cleanupAuthState } from '@/utils/authCleanup';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { AuthTabs } from '@/components/auth/AuthTabs';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { ErrorDisplay } from '@/components/auth/ErrorDisplay';

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

  const handleCleanupAndRestart = () => {
    cleanupAuthState();
    window.location.reload();
  };

  // Si hay error en el perfil, mostrar opción de debug
  if (authUser && profileError) {
    return (
      <AuthBackground>
        <ErrorDisplay
          authUser={authUser}
          profileError={profileError}
          onRetryProfile={retryFetchProfile}
          onForceRefresh={forceRefreshProfile}
          onCleanupAndRestart={handleCleanupAndRestart}
        />
      </AuthBackground>
    );
  }

  return (
    <AuthBackground>
      <div className="w-[400px]">
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
