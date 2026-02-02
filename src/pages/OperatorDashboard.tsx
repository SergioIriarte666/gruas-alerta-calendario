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
  const {
    user
  } = useUser();
  const {
    serviceTabs,
    isLoading,
    error,
    refreshAllData
  } = useOperatorServicesTabs();
  const [activeTab, setActiveTab] = useState('asignados');
  const [isRefreshing, setIsRefreshing] = useState(false);
  console.log('🏠 OperatorDashboard - Render state:', {
    user: user ? {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email
    } : 'no user',
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
    return <div className="space-y-4">
        <Skeleton className="h-44 w-full bg-muted rounded-lg" />
        <Skeleton className="h-44 w-full bg-muted rounded-lg" />
      </div>;
  }
  if (error) {
    console.log('❌ Rendering error state:', error.message);
    const isNoOperatorError = error.message.includes('No se encontró operador') || error.message.includes('operador');
    return <div className="text-center bg-destructive/10 border border-destructive/30 p-8 rounded-lg">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
        <h2 className="text-xl font-semibold mb-2 text-destructive">
          {isNoOperatorError ? 'Usuario no asignado como operador' : 'Error al cargar servicios'}
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto mb-4">
          {isNoOperatorError ? 'Tu usuario no está configurado como operador. Contacta al administrador para que te asigne como operador en el sistema.' : error.message || 'Hubo un problema al cargar tus servicios asignados.'}
        </p>
        <Button onClick={handleRefresh} variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" disabled={isRefreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Recargando...' : 'Recargar'}
        </Button>
      </div>;
  }
  const totalServices = serviceTabs.asignados.length + serviceTabs.activos.length + serviceTabs.completados.length;
  if (totalServices === 0) {
    console.log('📭 Rendering no services state');
    return <div className="text-center bg-card p-8 rounded-lg border border-border">
        <h2 className="text-xl font-semibold mb-2 text-foreground">No hay servicios</h2>
        <p className="text-muted-foreground max-w-md mx-auto mb-4">
          En este momento, no tienes ningún servicio de grúa asignado. Los nuevos servicios asignados aparecerán aquí.
        </p>
        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Operador: <span className="text-foreground">{user?.name || user?.email}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="text-primary">Email:</span> {user?.email}
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="text-primary">Estado:</span> <span className="text-primary">Activo y listo para servicios</span>
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" className="mt-4" disabled={isRefreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Actualizando...' : 'Actualizar'}
        </Button>
      </div>;
  }
  console.log('✅ Rendering services with tabs');
  return <div className="space-y-8 animate-fade-in">
      <header className="flex justify-between items-center pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold text-violet-500">Portal del Operador</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-muted-foreground">
              Bienvenido, {user?.name || user?.email}
            </span>
            {user?.role && <Badge variant="secondary">
                {user.role}
              </Badge>}
          </div>
        </div>
        <Button onClick={handleRefresh} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" disabled={isRefreshing}>
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </header>
      
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full overflow-x-auto bg-muted border border-border">
            <TabsTrigger value="asignados" className="flex-1 min-w-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground hover:text-foreground">
              <Clock className="w-4 h-4 sm:mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">Asignados</span>
              {serviceTabs.asignados.length > 0 && <Badge variant="secondary" className="ml-1 sm:ml-2">
                  {serviceTabs.asignados.length}
                </Badge>}
            </TabsTrigger>
            <TabsTrigger value="pendientes_entrega" className="flex-1 min-w-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground hover:text-foreground">
              <Package className="w-4 h-4 sm:mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">Por Entregar</span>
              {serviceTabs.pendientes_entrega.length > 0 && <Badge variant="secondary" className="ml-1 sm:ml-2">
                  {serviceTabs.pendientes_entrega.length}
                </Badge>}
            </TabsTrigger>
            <TabsTrigger value="activos" className="flex-1 min-w-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground hover:text-foreground">
              <Play className="w-4 h-4 sm:mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">Activos</span>
              {serviceTabs.activos.length > 0 && <Badge variant="secondary" className="ml-1 sm:ml-2">
                  {serviceTabs.activos.length}
                </Badge>}
            </TabsTrigger>
            <TabsTrigger value="completados" className="flex-1 min-w-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground hover:text-foreground">
              <CheckCircle className="w-4 h-4 sm:mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">Completados</span>
              {serviceTabs.completados.length > 0 && <Badge variant="secondary" className="ml-1 sm:ml-2">
                  {serviceTabs.completados.length}
                </Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="asignados" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Servicios Asignados</h2>
              <Badge variant="secondary">
                {serviceTabs.asignados.length} servicio{serviceTabs.asignados.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            {serviceTabs.asignados.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay servicios asignados pendientes</p>
              </div> : serviceTabs.asignados.map(service => <AssignedServiceCard key={service.id} service={service} />)}
          </TabsContent>

          <TabsContent value="activos" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Servicios Activos</h2>
              <Badge variant="secondary">
                {serviceTabs.activos.length} servicio{serviceTabs.activos.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            {serviceTabs.activos.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay servicios en progreso</p>
              </div> : serviceTabs.activos.map(service => <AssignedServiceCard key={service.id} service={service} />)}
          </TabsContent>

          <TabsContent value="pendientes_entrega" className="space-y-4">
            <h2 className="text-xl font-semibold text-accent flex items-center gap-2">
              <Package className="w-5 h-5" />
              Servicios Listos para Entrega ({serviceTabs.pendientes_entrega.length})
            </h2>
            {serviceTabs.pendientes_entrega.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay servicios pendientes de entrega</p>
              </div> : <div className="grid gap-4">
                {serviceTabs.pendientes_entrega.map(service => <AssignedServiceCard key={service.id} service={service} showDeliveryAction={true} />)}
              </div>}
          </TabsContent>

          <TabsContent value="completados" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Servicios Completados</h2>
              <Badge variant="secondary">
                {serviceTabs.completados.length} servicio{serviceTabs.completados.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            {serviceTabs.completados.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay servicios completados</p>
              </div> : serviceTabs.completados.map(service => <AssignedServiceCard key={service.id} service={service} />)}
          </TabsContent>
        </Tabs>
      </div>

      <footer className="text-center text-muted-foreground text-sm pt-4">
        <p>Gruas 5 Norte &copy; {new Date().getFullYear()}</p>
        <p className="text-xs mt-1">
          {user?.id ? '✅ Usuario identificado correctamente' : '❌ Error de identificación de usuario'}
        </p>
      </footer>
    </div>;
};
export default OperatorDashboard;