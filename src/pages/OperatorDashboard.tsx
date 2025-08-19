
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle, Clock, Play, CheckCircle, Package } from 'lucide-react';
import { useOperatorServicesTabs } from '@/hooks/useOperatorServicesTabs';
import { AssignedServiceCard } from '@/components/operator/AssignedServiceCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';

const OperatorDashboard = () => {
  const { user } = useUser();
  const { serviceTabs, isLoading, error, refreshAllData } = useOperatorServicesTabs();
  const [activeTab, setActiveTab] = useState('asignados');
  const [isRefreshing, setIsRefreshing] = useState(false);

  console.log('🏠 OperatorDashboard - Render state:', { 
    user: user ? { id: user.id, name: user.name, role: user.role, email: user.email } : 'no user',
    serviceTabs,
    totalServices: serviceTabs.asignados.length + serviceTabs.activos.length + serviceTabs.pendientes_entrega.length + serviceTabs.completados.length,
    isLoading, 
    error: error?.message || 'no error'
  });

  const handleRefresh = async () => {
    console.log('🔄 Manual refresh requested');
    setIsRefreshing(true);
    try {
      await refreshAllData();
      console.log('✅ Refresh completed');
    } catch (err) {
      console.error('❌ Refresh failed:', err);
    } finally {
      setIsRefreshing(false);
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
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          className="border-red-500 text-red-400 hover:bg-red-500/10"
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Recargando...' : 'Recargar'}
        </Button>
      </div>
    );
  }

  const totalServices = serviceTabs.asignados.length + serviceTabs.activos.length + serviceTabs.completados.length;
  
  if (totalServices === 0) {
    console.log('📭 Rendering no services state');
    return (
      <div className="text-center bg-slate-800 p-8 rounded-lg border border-slate-700">
        <h2 className="text-xl font-semibold mb-2 text-white">No hay servicios</h2>
        <p className="text-gray-400 max-w-md mx-auto mb-4">
          En este momento, no tienes ningún servicio de grúa asignado. Los nuevos servicios asignados aparecerán aquí.
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
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          className="mt-4"
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Actualizando...' : 'Actualizar'}
        </Button>
      </div>
    );
  }

  console.log('✅ Rendering services with tabs');
  
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
        <Button 
          onClick={handleRefresh} 
          variant="ghost" 
          size="sm"
          className="text-gray-400 hover:text-white"
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </header>
      
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800 border border-slate-700">
            <TabsTrigger 
              value="asignados" 
              className="data-[state=active]:bg-tms-green data-[state=active]:text-black text-gray-300 hover:text-white"
            >
              <Clock className="w-4 h-4 mr-2" />
              Asignados
              {serviceTabs.asignados.length > 0 && (
                <Badge className="ml-2 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                  {serviceTabs.asignados.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="pendientes_entrega" 
              className="data-[state=active]:bg-tms-green data-[state=active]:text-black text-gray-300 hover:text-white"
            >
              <Package className="w-4 h-4 mr-2" />
              Por Entregar
              {serviceTabs.pendientes_entrega.length > 0 && (
                <Badge className="ml-2 bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  {serviceTabs.pendientes_entrega.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="activos" 
              className="data-[state=active]:bg-tms-green data-[state=active]:text-black text-gray-300 hover:text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              Activos
              {serviceTabs.activos.length > 0 && (
                <Badge className="ml-2 bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {serviceTabs.activos.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="completados" 
              className="data-[state=active]:bg-tms-green data-[state=active]:text-black text-gray-300 hover:text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Completados
              {serviceTabs.completados.length > 0 && (
                <Badge className="ml-2 bg-green-500/20 text-green-300 border border-green-500/30">
                  {serviceTabs.completados.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="asignados" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Servicios Asignados</h2>
              <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                {serviceTabs.asignados.length} servicio{serviceTabs.asignados.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            {serviceTabs.asignados.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay servicios asignados pendientes</p>
              </div>
            ) : (
              serviceTabs.asignados.map(service => (
                <AssignedServiceCard key={service.id} service={service} />
              ))
            )}
          </TabsContent>

          <TabsContent value="activos" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Servicios Activos</h2>
              <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {serviceTabs.activos.length} servicio{serviceTabs.activos.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            {serviceTabs.activos.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay servicios en progreso</p>
              </div>
            ) : (
              serviceTabs.activos.map(service => (
                <AssignedServiceCard key={service.id} service={service} />
              ))
            )}
          </TabsContent>

          <TabsContent value="pendientes_entrega" className="space-y-4">
            <h2 className="text-xl font-semibold text-orange-400 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Servicios Listos para Entrega ({serviceTabs.pendientes_entrega.length})
            </h2>
            {serviceTabs.pendientes_entrega.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay servicios pendientes de entrega</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {serviceTabs.pendientes_entrega.map((service) => (
                  <AssignedServiceCard 
                    key={service.id} 
                    service={service} 
                    showDeliveryAction={true}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completados" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Servicios Completados</h2>
              <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">
                {serviceTabs.completados.length} servicio{serviceTabs.completados.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            {serviceTabs.completados.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay servicios completados</p>
              </div>
            ) : (
              serviceTabs.completados.map(service => (
                <AssignedServiceCard key={service.id} service={service} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <footer className="text-center text-gray-500 text-sm pt-4">
        <p>Gruas 5 Norte &copy; {new Date().getFullYear()}</p>
        <p className="text-xs mt-1">
          {user?.id ? '✅ Usuario identificado correctamente' : '❌ Error de identificación de usuario'}
        </p>
      </footer>
    </div>
  );
};

export default OperatorDashboard;
