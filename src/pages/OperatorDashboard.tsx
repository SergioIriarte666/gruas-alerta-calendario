
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useOperatorServices } from '@/hooks/useOperatorServices';
import { AssignedServiceCard } from '@/components/operator/AssignedServiceCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const OperatorDashboard = () => {
  const { user } = useUser();
  const { data: services, isLoading, error, refetch } = useOperatorServices(user?.id);

  console.log('🏠 OperatorDashboard - Render state:', { 
    user: user ? { id: user.id, name: user.name, role: user.role, email: user.email } : 'no user',
    servicesCount: services?.length || 0,
    isLoading, 
    error: error?.message || 'no error'
  });

  const handleRefresh = async () => {
    console.log('🔄 Manual refresh requested');
    try {
      await refetch();
      console.log('✅ Refresh completed');
    } catch (err) {
      console.error('❌ Refresh failed:', err);
    }
  };

  if (isLoading) {
    console.log('⏳ Rendering loading state');
    return (
      <div className="space-y-4">
        <Skeleton className="h-44 w-full bg-slate-700 rounded-lg" />
        <Skeleton className="h-44 w-full bg-slate-700 rounded-lg" />
      </div>
    );
  }

  if (error) {
    console.log('❌ Rendering error state:', error.message);
    
    const isNoOperatorError = error.message.includes('No se encontró operador') || error.message.includes('operador');
    
    return (
      <div className="text-center bg-red-900/20 border border-red-500/30 p-8 rounded-lg">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2 className="text-xl font-semibold mb-2 text-red-400">
          {isNoOperatorError ? 'Usuario no asignado como operador' : 'Error al cargar servicios'}
        </h2>
        <p className="text-gray-400 max-w-md mx-auto mb-4">
          {isNoOperatorError 
            ? 'Tu usuario no está configurado como operador. Contacta al administrador para que te asigne como operador en el sistema.'
            : (error.message || 'Hubo un problema al cargar tus servicios asignados.')
          }
        </p>
        <Button onClick={handleRefresh} variant="outline" className="border-red-500 text-red-400 hover:bg-red-500/10">
          <RefreshCw className="w-4 h-4 mr-2" />
          Recargar
        </Button>
      </div>
    );
  }
  
  if (!services || services.length === 0) {
    console.log('📭 Rendering no services state');
    return (
      <div className="text-center bg-slate-800 p-8 rounded-lg border border-slate-700">
        <h2 className="text-xl font-semibold mb-2 text-white">No hay servicios asignados</h2>
        <p className="text-gray-400 max-w-md mx-auto mb-4">
          En este momento, no tienes ningún servicio de grúa pendiente o en progreso. Los nuevos servicios asignados aparecerán aquí.
        </p>
        <div className="mt-4 p-4 bg-slate-700/50 rounded-lg">
          <p className="text-sm text-gray-400">
            Operador: <span className="text-white">{user?.name || user?.email}</span>
          </p>
          <p className="text-sm text-gray-400">
            <span className="text-tms-green">Email:</span> {user?.email}
          </p>
          <p className="text-sm text-gray-400">
            <span className="text-tms-green">Estado:</span> <span className="text-tms-green">Activo y listo para servicios</span>
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" className="mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>
    );
  }

  console.log('✅ Rendering services list:', services.length, 'services');
  
  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex justify-between items-center pb-4 border-b border-slate-700">
        <div>
          <h1 className="text-2xl font-bold text-tms-green">Portal del Operador</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-400">
              Bienvenido, {user?.name || user?.email}
            </span>
            {user?.role && (
              <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {user.role}
              </Badge>
            )}
          </div>
        </div>
      </header>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Tus Servicios Asignados</h2>
          <div className="flex items-center gap-2">
            <Badge className="bg-tms-green/20 text-tms-green border border-tms-green/30">
              {services.length} servicio{services.length !== 1 ? 's' : ''}
            </Badge>
            <Button 
              onClick={handleRefresh} 
              variant="ghost" 
              size="sm"
              className="text-gray-400 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {services.map(service => (
          <AssignedServiceCard key={service.id} service={service} />
        ))}
      </div>

      <footer className="text-center text-gray-500 text-sm pt-4">
        <p>TMS Grúas &copy; {new Date().getFullYear()}</p>
        <p className="text-xs mt-1">
          {user?.id ? '✅ Usuario identificado correctamente' : '❌ Error de identificación de usuario'}
        </p>
      </footer>
    </div>
  );
};

export default OperatorDashboard;
