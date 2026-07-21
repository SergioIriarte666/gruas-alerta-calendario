
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Download, Smartphone } from 'lucide-react';
import { usePWACapabilities } from '@/hooks/usePWACapabilities';
import { useUser } from '@/contexts/UserContext';
import { createLogger } from "@/lib/logger";


const logger = createLogger("InstallPrompt");
interface InstallPromptProps {
  userRole?: string;
}

export const InstallPrompt: React.FC<InstallPromptProps> = ({ userRole: _userRole }) => {
  const { canInstall, installApp } = usePWACapabilities();
  const { user } = useUser();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installTrigger, setInstallTrigger] = useState<string | null>(null);

  // Triggers contextuales específicos para TMS Grúas
  useEffect(() => {
    if (!canInstall || dismissed) return;

    const checkTriggers = () => {
      const currentPath = window.location.pathname;
      const sessionActions = parseInt(sessionStorage.getItem('tms-session-actions') || '0');
      
      // Trigger para operadores después de ver servicios asignados
      if (user?.role === 'operator' && currentPath === '/operator' && sessionActions >= 2) {
        setInstallTrigger('operator');
        setShow(true);
        return;
      }
      
      // Trigger para admin después de usar funcionalidades core
      if (user?.role === 'admin' && (currentPath === '/services' || currentPath === '/dashboard') && sessionActions >= 3) {
        setInstallTrigger('admin');
        setShow(true);
        return;
      }
      
      // Trigger para gestores al usar carga masiva
      if (currentPath === '/services' && sessionStorage.getItem('tms-csv-upload-used')) {
        setInstallTrigger('bulk');
        setShow(true);
        return;
      }
    };

    const timer = setTimeout(checkTriggers, 2000);
    return () => clearTimeout(timer);
  }, [canInstall, dismissed, user]);

  // Incrementar contador de acciones
  useEffect(() => {
    const incrementActions = () => {
      const current = parseInt(sessionStorage.getItem('tms-session-actions') || '0');
      sessionStorage.setItem('tms-session-actions', (current + 1).toString());
    };

    // Escuchar navegación y clicks importantes
    window.addEventListener('click', incrementActions);
    window.addEventListener('popstate', incrementActions);

    return () => {
      window.removeEventListener('click', incrementActions);
      window.removeEventListener('popstate', incrementActions);
    };
  }, []);

  const handleInstall = async () => {
    try {
      await installApp();
      setShow(false);
      
      // Analytics
      logger.debug('PWA installed:', { trigger: installTrigger, userRole: user?.role });
    } catch (error) {
      logger.error('Installation failed:', error);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShow(false);
    localStorage.setItem('tms-install-dismissed', Date.now().toString());
  };

  const getPromptContent = () => {
    switch (installTrigger) {
      case 'operator':
        return {
          title: '🚛 Trabaja offline en campo',
          description: 'Instala la app para completar servicios sin conexión a internet',
          benefits: ['Acceso offline a servicios asignados', 'Completar inspecciones sin señal', 'Sincronización automática']
        };
      case 'admin':
        return {
          title: '⚡ Gestión más rápida',
          description: 'Instala la app para acceso rápido y notificaciones en tiempo real',
          benefits: ['Notificaciones de servicios completados', 'Acceso rápido desde escritorio', 'Mejor rendimiento']
        };
      case 'bulk':
        return {
          title: '📊 Optimiza cargas masivas',
          description: 'Instala la app para mejor rendimiento en operaciones de carga masiva',
          benefits: ['Procesamiento más rápido', 'Menos consumo de memoria', 'Trabajo offline']
        };
      default:
        return {
          title: '📱 Instalar TMS Grúas',
          description: 'Obtén acceso rápido y funcionalidades offline',
          benefits: ['Acceso rápido', 'Trabajo offline', 'Notificaciones']
        };
    }
  };

  if (!show || !canInstall) return null;

  const content = getPromptContent();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay/75 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md border-border/70 bg-card shadow-2xl">
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary">
              <Smartphone className="size-6 text-primary-foreground" />
            </div>
            <div>
              <CardTitle>{content.title}</CardTitle>
              <CardDescription>
                {content.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Beneficios:</h4>
            <ul className="space-y-1">
              {content.benefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="size-1.5 rounded-full bg-primary" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleDismiss}
              variant="ghost"
              className="flex-1 text-muted-foreground hover:text-foreground"
            >
              Ahora no
            </Button>
            <Button
              onClick={handleInstall}
              className="flex-1 bg-primary font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download className="size-4 mr-2" />
              Instalar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
