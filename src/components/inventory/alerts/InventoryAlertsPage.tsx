import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Settings, Activity, TrendingUp, Bell, Plus, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useActiveAlerts, useAlertStats } from '@/hooks/useInventoryAlerts';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { ActiveAlertsList } from './ActiveAlertsList';
import { AlertConfigurationPanel } from './AlertConfigurationPanel';
import { AlertDashboard } from './AlertDashboard';
import { AlertHistoryView } from './AlertHistoryView';
import { AuthErrorHandler } from './AuthErrorHandler';
import SessionVerifier from '@/components/auth/SessionVerifier';

export const InventoryAlertsPage: React.FC = () => {
  const [showNewAlertForm, setShowNewAlertForm] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const { data: activeAlerts = [], isLoading: alertsLoading } = useActiveAlerts();
  const { data: alertStats } = useAlertStats();
  const { canCreateAlerts, user, isAuthenticated, isLoading: permissionsLoading } = useUserPermissions();

  const handleNewAlertClick = () => {
    console.log('Nueva Alerta button clicked');
    setShowNewAlertForm(true);
    setActiveTab("configuration");
  };

  if (permissionsLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-64 mb-2"></div>
          <div className="h-4 bg-muted rounded w-96"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-24 bg-muted rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  console.log('InventoryAlertsPage render - showNewAlertForm:', showNewAlertForm);

  return (
    <div className="space-y-6">
      <SessionVerifier checkInterval={30000} autoRecover={true} />
      <AuthErrorHandler onRetry={() => window.location.reload()}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Alertas de Inventario</h1>
          <p className="text-muted-foreground">
            Monitoreo y configuración de alertas automáticas
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {alertStats && alertStats.criticalAlerts > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {alertStats.criticalAlerts} Críticas
              </Badge>
            )}
            {alertStats && alertStats.warningAlerts > 0 && (
              <Badge variant="outline" className="flex items-center gap-1 border-warning text-warning">
                <Bell className="w-3 h-3" />
                {alertStats.warningAlerts} Advertencias
              </Badge>
            )}
          </div>
          
          <Button 
            onClick={handleNewAlertClick}
            className="flex items-center gap-2"
            disabled={!canCreateAlerts}
            title={!canCreateAlerts ? `Permisos insuficientes. Rol actual: ${user?.role}` : undefined}
          >
            {!canCreateAlerts && <Shield className="w-4 h-4" />}
            <Plus className="w-4 h-4" />
            Nueva Alerta
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Alertas Activas</p>
                <p className="text-2xl font-bold text-foreground">
                  {alertStats?.totalActiveAlerts || 0}
                </p>
              </div>
              <Bell className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Críticas</p>
                <p className="text-2xl font-bold text-destructive">
                  {alertStats?.criticalAlerts || 0}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Configuradas</p>
                <p className="text-2xl font-bold text-foreground">
                  {alertStats?.activeConfigurations || 0}
                </p>
              </div>
              <Settings className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Reglas</p>
                <p className="text-2xl font-bold text-foreground">
                  {alertStats?.totalAlerts || 0}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Alertas Activas
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="configuration" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configuración
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Historial
          </TabsTrigger>
        </TabsList>

        {/* Alertas Activas */}
        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Alertas Activas
              </CardTitle>
              <CardDescription>
                Monitoreo en tiempo real de alertas críticas y advertencias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActiveAlertsList alerts={activeAlerts} loading={alertsLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dashboard */}
        <TabsContent value="dashboard" className="space-y-4">
          <AlertDashboard />
        </TabsContent>

        {/* Configuración */}
        <TabsContent value="configuration" className="space-y-4">
          <AlertConfigurationPanel 
            showNewForm={showNewAlertForm}
            onShowNewForm={() => {
              console.log('onShowNewForm called, setting showNewAlertForm to true');
              setShowNewAlertForm(true);
            }}
            onCloseNewForm={() => {
              console.log('onCloseNewForm called, setting showNewAlertForm to false');
              setShowNewAlertForm(false);
            }}
          />
        </TabsContent>

        {/* Historial */}
        <TabsContent value="history" className="space-y-4">
          <AlertHistoryView />
        </TabsContent>
      </Tabs>
      </AuthErrorHandler>
    </div>
  );
};