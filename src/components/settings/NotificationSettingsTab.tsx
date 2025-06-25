
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PushNotificationManager } from '@/components/notifications/PushNotificationManager';
import { Bell, Smartphone, Mail } from 'lucide-react';

export const NotificationSettingsTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="w-6 h-6 text-tms-green" />
        <div>
          <h2 className="text-2xl font-bold text-white">Configuración de Notificaciones</h2>
          <p className="text-slate-400">
            Gestiona cómo y cuándo recibes notificaciones del sistema
          </p>
        </div>
      </div>

      {/* Push Notifications */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Notificaciones Push
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PushNotificationManager />
        </CardContent>
      </Card>

      {/* Email Notifications */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Notificaciones por Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-slate-400">
              Las notificaciones por email están habilitadas automáticamente para:
            </p>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>• Confirmación de servicios completados</li>
              <li>• Inspecciones con PDF adjunto</li>
              <li>• Facturas generadas</li>
              <li>• Invitaciones de usuario</li>
              <li>• Recordatorios de vencimientos</li>
            </ul>
            <p className="text-xs text-slate-500 mt-4">
              Las notificaciones por email no se pueden deshabilitar ya que contienen información crítica del negocio.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* In-App Notifications */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notificaciones en la Aplicación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-slate-400">
              Las notificaciones dentro de la aplicación incluyen:
            </p>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>• Alertas de vencimientos en el dashboard</li>
              <li>• Toasts de confirmación de acciones</li>
              <li>• Estados de sincronización</li>
              <li>• Errores y advertencias del sistema</li>
            </ul>
            <p className="text-xs text-slate-500 mt-4">
              Estas notificaciones están siempre activas para garantizar el buen funcionamiento del sistema.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
