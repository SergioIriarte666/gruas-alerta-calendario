import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { portalLoginSchema, PortalLoginSchema } from '@/schemas/portalAuthSchema';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/custom-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const PortalLogin = () => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PortalLoginSchema>({
    resolver: zodResolver(portalLoginSchema),
  });
  const { session, forceRefresh } = useAuth();
  const { user: profileUser, loading: profileLoading } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Si el usuario está logueado y es un cliente, redirigir al dashboard del portal.
    if (session && profileUser && profileUser.role === 'client') {
      navigate('/portal/dashboard', { replace: true });
    }
  }, [session, profileUser, navigate]);

  const onSubmit = async (data: PortalLoginSchema) => {
    try {
      const { error, data: authData } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        throw error;
      }

      if (authData.user) {
        // Forzar la recarga del contexto para obtener el nuevo perfil
        await forceRefresh();
        
        toast({
          type: 'success',
          title: 'Inicio de sesión exitoso',
          description: '¡Bienvenido al portal de clientes!',
        });

        // La redirección se manejará con el useEffect de arriba
      }
    } catch (error: any) {
      toast({
        type: 'error',
        title: 'Error al iniciar sesión',
        description: error.message || 'Ocurrió un error inesperado.',
      });
    }
  };

  // Prevenir que un usuario no-cliente logueado vea esta página
  if (session && profileUser && profileUser.role !== 'client' && !profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-2xl">Acceso no autorizado</h1>
          <p className="text-gray-400">Eres un usuario interno. Por favor, accede por el <a href="/dashboard" className="text-tms-green underline">panel principal</a>.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Portal de Cliente</h1>
          <p className="text-gray-400">Ingrese a su cuenta para gestionar sus servicios.</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="email" className="block text-sm font-medium text-gray-300">Email</Label>
            <Input 
              id="email"
              type="email" 
              className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring focus:ring-tms-green"
              placeholder="usted@cliente.com"
              {...register('email')}
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="password"className="block text-sm font-medium text-gray-300">Contraseña</Label>
            <Input 
              id="password"
              type="password" 
              className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring focus:ring-tms-green"
              placeholder="••••••••"
              {...register('password')}
            />
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
          </div>
          <Button 
            type="submit"
            className="w-full py-2 font-semibold text-white bg-tms-green rounded-md hover:bg-tms-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tms-green-dark"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default PortalLogin;
