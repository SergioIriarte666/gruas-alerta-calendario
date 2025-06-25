
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { AuthTabs } from '@/components/auth/AuthTabs';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    // Only redirect when we have both auth user and profile user and are not loading
    if (!authLoading && !profileLoading && authUser && profileUser) {
      console.log('Redirecting authenticated user:', profileUser.role);
      
      if (profileUser.role === 'client') {
        navigate('/portal', { replace: true });
      } else if (profileUser.role === 'operator') {
        navigate('/operator', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [authUser, profileUser, authLoading, profileLoading, navigate]);

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
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });
      
      if (error) {
        console.error('Signup error:', error);
        toast.error('Error en el registro', {
          description: error.message
        });
      } else {
        console.log('Signup successful');
        toast.success('Registro exitoso', {
          description: 'Por favor, revisa tu correo para confirmar tu cuenta.'
        });
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
