import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useInventorySyncStats, useMigrateUnsyncParts } from '@/hooks/useUnifiedParts';
import { Package, Download, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';

export const InventorySyncDashboard = () => {
  const { data: stats, isLoading } = useInventorySyncStats();
  const migrateMutation = useMigrateUnsyncParts();
  const [confirmMigrationOpen, setConfirmMigrationOpen] = useState(false);

  const handleMigration = () => setConfirmMigrationOpen(true);

  const confirmMigration = () => {
    setConfirmMigrationOpen(false);
    migrateMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  const syncPercentage = stats?.sync_percentage || 0;
  const needsMigration = (stats?.unsynced_parts || 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Estado de Sincronización de Inventario</h2>
          <p className="text-muted-foreground">Monitor de la integración entre piezas de grúa e inventario</p>
        </div>
        {needsMigration && (
          <Button 
            onClick={handleMigration}
            disabled={migrateMutation.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {migrateMutation.isPending ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Migrando...
              </>
            ) : (
              <>
                <Download className="size-4 mr-2" />
                Migrar Piezas
              </>
            )}
          </Button>
        )}
      </div>

      {/* Status Alert */}
      {!stats?.trigger_exists && (
        <Alert className="border-destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            El trigger de sincronización automática no está activo. Las nuevas piezas no se sincronizarán automáticamente.
          </AlertDescription>
        </Alert>
      )}

      {needsMigration && (
        <Alert className="border-warning">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Hay {stats?.unsynced_parts} piezas que no están sincronizadas con el inventario. Se recomienda ejecutar la migración.
          </AlertDescription>
        </Alert>
      )}

      {syncPercentage === 100 && (
        <Alert className="border-success">
          <CheckCircle className="size-4" />
          <AlertDescription>
            ¡Todas las piezas están sincronizadas correctamente con el inventario!
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progreso de Sincronización</CardTitle>
            <Package className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">{syncPercentage.toFixed(1)}%</div>
              <Progress value={syncPercentage} className="w-full" />
              <p className="text-xs text-muted-foreground">
                {stats?.synced_parts} de {stats?.total_parts} piezas sincronizadas
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Items Auto-creados</CardTitle>
            <Package className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.auto_created_items || 0}</div>
            <p className="text-xs text-muted-foreground">
              Items de inventario creados automáticamente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inventario</CardTitle>
            <Package className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_inventory_items || 0}</div>
            <p className="text-xs text-muted-foreground">
              Items totales en inventario
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Piezas Pendientes</CardTitle>
            <AlertTriangle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats?.unsynced_parts || 0}</div>
            <p className="text-xs text-muted-foreground">
              Piezas sin sincronizar
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>Estado del Sistema</CardTitle>
          <CardDescription>
            Información sobre el estado de los componentes de sincronización
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Trigger de Sincronización Automática</span>
            <Badge variant={stats?.trigger_exists ? "default" : "destructive"}>
              {stats?.trigger_exists ? "Activo" : "Inactivo"}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm">Estado de Sincronización</span>
            <Badge variant={syncPercentage === 100 ? "default" : syncPercentage > 50 ? "secondary" : "destructive"}>
              {syncPercentage === 100 ? "Completa" : syncPercentage > 50 ? "Parcial" : "Crítica"}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm">Funciones de Migración</span>
            <Badge variant="default">Disponibles</Badge>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmMigrationOpen} onOpenChange={setConfirmMigrationOpen}>
        <AlertDialogContent className="border-border/70 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirmar migración</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Se migrarán todas las piezas no sincronizadas al inventario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMigration}>
              Migrar piezas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
