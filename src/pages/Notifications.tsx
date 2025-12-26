import React from 'react';
import { Bell } from 'lucide-react';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

const Notifications = () => {
  return (
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Centro de Notificaciones</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona todas las alertas y avisos del sistema
            </p>
          </div>
        </div>

        {/* Notification Center Component */}
        <NotificationCenter />
      </div>
  );
};

export default Notifications;
