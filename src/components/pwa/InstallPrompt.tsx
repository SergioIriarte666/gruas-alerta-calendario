
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Download, Smartphone } from 'lucide-react';
import { usePWACapabilities } from '@/hooks/usePWACapabilities';
import { useUser } from '@/contexts/UserContext';

interface InstallPromptProps {
  userRole?: string;
}

export const InstallPrompt: React.FC<InstallPromptProps> = ({ userRole }) => {
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
      console.log('PWA installed:', { trigger: installTrigger, userRole: user?.role });
    } catch (error) {
      console.error('Installation failed:', error);
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="absolute right-2 top-2 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-tms-green rounded-lg flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-white">{content.title}</CardTitle>
              <CardDescription className="text-gray-400">
                {content.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white">Beneficios:</h4>
            <ul className="space-y-1">
              {content.benefits.map((benefit, index) => (
                <li key={index} className="text-sm text-gray-400 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-tms-green rounded-full" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleDismiss}
              variant="ghost"
              className="flex-1 text-gray-400 hover:text-white"
            >
              Ahora no
            </Button>
            <Button
              onClick={handleInstall}
              className="flex-1 bg-tms-green hover:bg-tms-green/90 text-slate-900 font-medium"
            >
              <Download className="w-4 h-4 mr-2" />
              Instalar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
