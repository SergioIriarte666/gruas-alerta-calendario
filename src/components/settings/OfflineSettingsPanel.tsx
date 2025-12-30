/**
 * Panel de configuración offline en Settings
 * Muestra estado de PWA, cache y sincronización
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Trash2,
  Download,
  HardDrive,
  Clock,
  CheckCircle,
  AlertCircle,
  Smartphone,
  Database,
  CloudOff,
  Loader2,
  FlaskConical,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import {
  getAllCacheMetadata,
  getCacheSize,
  clearAllCache,
  CacheMetadata
} from '@/services/offlineDataCache';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const OfflineSettingsPanel: React.FC = () => {
  const { 
    isOnline, 
    isSyncing, 
    pendingActions, 
    lastSyncTime, 
    syncPendingActions,
    clearAllPendingActions 
  } = useOfflineSync();
  
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const { isForceOffline, toggleForceOffline } = useOfflineMode();
  
  const [cacheMetadata, setCacheMetadata] = useState<CacheMetadata[]>([]);
  const [cacheSize, setCacheSize] = useState(0);
  const [isLoadingCache, setIsLoadingCache] = useState(true);
  const [isClearingCache, setIsClearingCache] = useState(false);

  useEffect(() => {
    loadCacheInfo();
  }, []);

  const loadCacheInfo = async () => {
    setIsLoadingCache(true);
    try {
      const [metadata, size] = await Promise.all([
        getAllCacheMetadata(),
        getCacheSize()
      ]);
      setCacheMetadata(metadata);
      setCacheSize(size);
    } catch (error) {
      console.error('Error loading cache info:', error);
    } finally {
      setIsLoadingCache(false);
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      await clearAllCache();
      await clearAllPendingActions();
      await loadCacheInfo();
      toast.success('Cache limpiado', {
        description: 'Todos los datos locales han sido eliminados'
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast.error('Error al limpiar cache');
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      toast.error('Sin conexión', {
        description: 'No es posible sincronizar sin conexión a internet'
      });
      return;
    }
    await syncPendingActions();
  };

  const handleInstallPWA = async () => {
    try {
      await promptInstall();
    } catch (error) {
      console.error('Error installing PWA:', error);
    }
  };

  const maxCacheSize = 100 * 1024 * 1024; // 100 MB
  const cacheUsagePercent = Math.min((cacheSize / maxCacheSize) * 100, 100);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CloudOff className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-foreground">Modo Offline</CardTitle>
              <CardDescription>
                Configura el funcionamiento sin conexión
              </CardDescription>
            </div>
          </div>
          <Badge 
            className={isForceOffline
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              : isOnline 
                ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                : 'bg-red-500/20 text-red-400 border-red-500/30'
            }
          >
            {isForceOffline ? (
              <><FlaskConical className="w-3 h-3 mr-1" /> Modo Prueba</>
            ) : isOnline ? (
              <><Wifi className="w-3 h-3 mr-1" /> Conectado</>
            ) : (
              <><WifiOff className="w-3 h-3 mr-1" /> Sin conexión</>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Modo de Prueba Offline */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <FlaskConical className="w-4 h-4" />
            Modo de Prueba
          </h4>
          <div className="p-4 rounded-lg bg-muted/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1 mr-4">
                <Label htmlFor="force-offline" className="text-sm font-medium">
                  Simular modo sin conexión
                </Label>
                <p className="text-xs text-muted-foreground">
                  Activa para probar la funcionalidad offline sin desconectar tu red real
                </p>
              </div>
              <Switch
                id="force-offline"
                checked={isForceOffline}
                onCheckedChange={toggleForceOffline}
              />
            </div>
            
            {isForceOffline && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-400">
                  <p className="font-medium">Modo offline forzado activo</p>
                  <p className="mt-1 text-amber-400/80">
                    Los datos no se sincronizarán con el servidor hasta que desactives este modo.
                    Todos los cambios se guardarán localmente.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Estado de instalación PWA */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            Aplicación Instalable
          </h4>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="space-y-1">
              <p className="text-sm text-foreground">
                {isInstalled ? 'App instalada' : isInstallable ? 'Disponible para instalar' : 'No disponible'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isInstalled 
                  ? 'La aplicación está instalada en tu dispositivo' 
                  : isInstallable 
                    ? 'Instala la app para acceso rápido y offline' 
                    : 'Abre en un navegador compatible para instalar'}
              </p>
            </div>
            {isInstallable && !isInstalled && (
              <Button onClick={handleInstallPWA} size="sm" className="bg-primary hover:bg-primary/90">
                <Download className="w-4 h-4 mr-2" />
                Instalar
              </Button>
            )}
            {isInstalled && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                Instalada
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        {/* Almacenamiento local */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <HardDrive className="w-4 h-4" />
            Almacenamiento Local
          </h4>
          
          {isLoadingCache ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Espacio usado</span>
                  <span className="text-foreground font-medium">{formatBytes(cacheSize)}</span>
                </div>
                <Progress value={cacheUsagePercent} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {formatBytes(cacheSize)} de {formatBytes(maxCacheSize)} (máx. recomendado)
                </p>
              </div>

              {cacheMetadata.length > 0 && (
                <ScrollArea className="h-32 rounded border border-border">
                  <div className="p-3 space-y-2">
                    {cacheMetadata.map((meta) => (
                      <div 
                        key={meta.tableName} 
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Database className="w-3 h-3 text-muted-foreground" />
                          <span className="text-foreground capitalize">{meta.tableName}</span>
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span>{meta.recordCount} registros</span>
                          <span>
                            {format(new Date(meta.lastSync), 'HH:mm', { locale: es })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleClearCache}
                disabled={isClearingCache || cacheSize === 0}
                className="w-full"
              >
                {isClearingCache ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Limpiar cache local
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* Sincronización */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Sincronización
          </h4>

          <div className="space-y-3">
            {/* Estado de sincronización */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="space-y-1">
                <p className="text-sm text-foreground">
                  {isSyncing ? 'Sincronizando...' : 'Última sincronización'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lastSyncTime 
                    ? format(lastSyncTime, "d 'de' MMMM, HH:mm", { locale: es })
                    : 'Nunca'}
                </p>
              </div>
              {isSyncing ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleManualSync}
                  disabled={!isOnline}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sincronizar
                </Button>
              )}
            </div>

            {/* Acciones pendientes */}
            {pendingActions.length > 0 && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-medium text-yellow-400">
                      {pendingActions.length} acciones pendientes
                    </span>
                  </div>
                </div>
                <ScrollArea className="max-h-24">
                  <div className="space-y-1">
                    {pendingActions.slice(0, 5).map((action) => (
                      <div 
                        key={action.id} 
                        className="text-xs text-muted-foreground flex items-center justify-between"
                      >
                        <span className="truncate">
                          {action.type} en {action.table}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={
                            action.status === 'failed' 
                              ? 'text-red-400 border-red-400/50' 
                              : 'text-yellow-400 border-yellow-400/50'
                          }
                        >
                          {action.status === 'failed' ? `Error (${action.retries}x)` : 'Pendiente'}
                        </Badge>
                      </div>
                    ))}
                    {pendingActions.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        +{pendingActions.length - 5} más
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Guía de uso */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Cómo funciona el modo offline
          </h4>
          <div className="text-xs text-muted-foreground space-y-2 p-3 rounded-lg bg-muted/30">
            <p>1. <strong>Sin conexión:</strong> Los cambios se guardan localmente</p>
            <p>2. <strong>Al reconectar:</strong> Los datos se sincronizan automáticamente</p>
            <p>3. <strong>Datos en cache:</strong> Puedes ver información aunque no haya internet</p>
            <p>4. <strong>Conflictos:</strong> Se mantiene la versión más reciente</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
