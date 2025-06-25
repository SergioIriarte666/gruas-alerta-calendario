
# Documentación Técnica - TMS Grúas

## Arquitectura del Sistema

### Stack Tecnológico Principal
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Estado**: React Query (TanStack Query) + Context API
- **Enrutamiento**: React Router DOM
- **Validación**: Zod + React Hook Form
- **PDF Generation**: jsPDF + jsPDF AutoTable
- **Excel Export**: XLSX + PapaParse
- **Notificaciones**: Sonner + **Web Push API**
- **Iconos**: Lucide React
- **Email**: Resend API
- **PWA**: Service Workers + Manifest + **Push Notifications**

## Estructura del Proyecto Actualizada

```
src/
├── components/           # Componentes organizados por módulo
│   ├── ui/              # Componentes base de shadcn/ui
│   ├── layout/          # Layouts y navegación
│   ├── notifications/   # Sistema de notificaciones push
│   │   └── PushNotificationManager.tsx
│   ├── operator/        # Módulo de operadores
│   │   ├── PhotographicSet.tsx    # Set fotográfico unificado
│   │   ├── InspectionFormSections.tsx
│   │   ├── SignaturePad.tsx
│   │   └── inspection/  # Subcomponentes de inspección
│   ├── portal/          # Portal de clientes
│   ├── settings/        # Configuraciones del sistema
│   └── ...              # Otros módulos
├── hooks/               # Hooks especializados
│   ├── usePushNotifications.ts      # Hook principal de notificaciones push
│   ├── useNotificationTriggers.ts   # Triggers automáticos de notificaciones
│   ├── inspection/      # Hooks de inspecciones
│   ├── services/        # Hooks de servicios
│   ├── settings/        # Hooks de configuración
│   └── ...              # Otros hooks
├── utils/               # Utilidades especializadas
│   ├── pdf/            # Generación de PDFs
│   ├── photoProcessor.ts         # Procesamiento de imágenes
│   ├── photoStorage.ts           # Almacenamiento local
│   └── ...              # Otras utilidades
├── schemas/             # Esquemas de validación
├── types/               # Definiciones de tipos
│   ├── notifications.ts # Tipos de notificaciones
│   └── ...              # Otros tipos
└── ...
```

## Sistema de Notificaciones Push (NUEVO)

### Arquitectura de Notificaciones

#### Componentes Principales
```typescript
// Hook principal para gestión de suscripciones
usePushNotifications(): {
  isSupported: boolean,
  isSubscribed: boolean,
  isLoading: boolean,
  permission: NotificationPermission,
  subscribe: () => Promise<boolean>,
  unsubscribe: () => Promise<boolean>,
  requestPermission: () => Promise<NotificationPermission>
}

// Hook para triggers automáticos por rol
useNotificationTriggers(): {
  sendPushNotification: (notification: NotificationTrigger) => Promise<void>
}

// Componente de gestión UI
PushNotificationManager: React.FC
```

#### Base de Datos - Tablas de Notificaciones
```sql
-- Suscripciones push por usuario
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Logs de notificaciones enviadas
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('push', 'email', 'in_app')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Edge Functions para Notificaciones

##### save-push-subscription
```typescript
// Guarda suscripción de usuario en la base de datos
POST /functions/v1/save-push-subscription
Body: {
  userId: string,
  subscription: PushSubscription,
  userAgent: string
}
```

##### send-push-notification
```typescript
// Envía notificación push a usuario específico
POST /functions/v1/send-push-notification
Body: {
  userId: string,
  notification: {
    title: string,
    body: string,
    data?: any,
    type: string
  }
}
```

##### remove-push-subscription
```typescript
// Desactiva suscripción de usuario
POST /functions/v1/remove-push-subscription
Body: {
  userId: string
}
```

### Flujo de Notificaciones por Rol

#### Para Administradores
```typescript
// Canal de notificaciones administrativas
supabase.channel('admin-notifications')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'services',
    filter: 'status=eq.completed'
  }, (payload) => {
    sendPushNotification({
      type: 'service_completed',
      title: '✅ Servicio Completado',
      body: `El servicio ${payload.new.folio} ha sido completado`
    });
  })
```

#### Para Operadores
```typescript
// Canal específico por operador
supabase.channel('operator-services')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'services',
    filter: `operator_id=eq.${user.id}`
  }, (payload) => {
    sendPushNotification({
      type: 'service_assigned',
      title: '🚛 Nuevo Servicio Asignado',
      body: `Se te ha asignado el servicio ${payload.new.folio}`
    });
  })
```

#### Para Clientes
```typescript
// Canal de servicios del cliente
supabase.channel('client-services')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'services',
    filter: `client_id=eq.${user.client_id}`
  }, (payload) => {
    sendPushNotification({
      type: 'service_completed',
      title: '🎉 Servicio Completado',
      body: `Tu servicio ${payload.new.folio} ha sido completado`
    });
  })
```

### Tipos de Notificaciones

#### Interfaces TypeScript
```typescript
interface NotificationTrigger {
  type: 'service_assigned' | 'service_completed' | 'inspection_ready' | 'invoice_generated';
  title: string;
  body: string;
  data?: any;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
  actionType?: 'navigate' | 'filter' | 'highlight';
  actionUrl?: string;
  actionData?: {
    entityId?: string;
    filter?: string;
    highlight?: string;
  };
}
```

### Service Worker Integration

#### Funcionalidades del Service Worker
```javascript
// public/sw.js - Manejo de push notifications
self.addEventListener('push', function(event) {
  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    tag: `${data.type}-${Date.now()}`,
    data: data.data,
    requireInteraction: data.type === 'service_assigned'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});
```

### Configuración de Preferencias

#### Preferencias por Usuario
```typescript
interface NotificationPreferences {
  newServices: boolean;          // Nuevos servicios asignados
  serviceUpdates: boolean;       // Actualizaciones de servicios
  inspectionCompleted: boolean;  // Inspecciones completadas
  invoiceGenerated: boolean;     // Facturas generadas
  systemAlerts: boolean;         // Alertas del sistema
}
```

### Integración con Contextos Existentes

#### NotificationContext Actualizado
```typescript
// Integración con sistema push existente
const NotificationProvider = ({ children }) => {
  // Mantiene compatibilidad con notificaciones in-app
  // Añade integración con push notifications
  
  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      removeNotification,
      // Nuevas funciones push
      enablePushNotifications,
      disablePushNotifications,
      updatePreferences
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
```

## Gestión de Estado

### React Query (TanStack Query)
- Cache automático con invalidación inteligente
- Optimistic updates para mejor UX
- Background refetching
- Error handling centralizado
- Loading states automáticos
- **Invalidación automática por notificaciones push**

### Context API
- `AuthContext`: Autenticación y sesión
- `UserContext`: Información del usuario actual
- `NotificationContext`: Sistema de notificaciones + **Push integration**

### Nuevos Hooks de Notificaciones

#### usePushNotifications.ts
```typescript
export const usePushNotifications = (): PushNotificationHook => {
  // Verificación de soporte del navegador
  // Gestión de permisos
  // Suscripción/Desuscripción
  // Estado de conexión
  // Manejo de errores
}
```

#### useNotificationTriggers.ts
```typescript
export const useNotificationTriggers = () => {
  // Configuración de canales por rol
  // Triggers automáticos de eventos
  // Invalidación de queries
  // Envío de notificaciones locales e push
}
```

## Seguridad y Performance

### Medidas de Seguridad para Notificaciones
- **Validación de suscripciones**: Una suscripción única por usuario
- **RLS en tablas**: Políticas estrictas de acceso a datos
- **Sanitización de contenido**: Validación de títulos y mensajes
- **Rate limiting**: Control de frecuencia de envío
- **Logs auditables**: Registro completo de actividad

### Optimizaciones de Performance
- **Lazy loading** de componente de notificaciones
- **Debounce** en configuración de preferencias
- **Cache** de estado de suscripción
- **Batch processing** de notificaciones múltiples
- **Service Worker** eficiente para push handling

## Edge Functions para Notificaciones

### send-push-notification/index.ts
```typescript
// Función principal para envío de notificaciones push
// Integración con VAPID keys
// Manejo de errores y reintentos
// Logging completo de actividad
```

### Configuración VAPID (Requerida)
```bash
# Variables de entorno para Edge Functions
VAPID_PUBLIC_KEY=BEL_YOUR_VAPID_PUBLIC_KEY_HERE
VAPID_PRIVATE_KEY=your_vapid_private_key_here
VAPID_SUBJECT=mailto:your-email@domain.com
```

## Testing del Sistema de Notificaciones

### Casos de Prueba
1. **Permisos del navegador**: Solicitud y manejo de permisos
2. **Suscripción/Desuscripción**: Proceso completo
3. **Envío de notificaciones**: Por cada tipo de evento
4. **Preferencias de usuario**: Configuración granular
5. **Fallbacks**: Funcionamiento sin soporte push
6. **Roles y permisos**: Notificaciones específicas por rol

### Herramientas de Debug
- Console logs estructurados en hooks
- Supabase Dashboard para monitoreo de Edge Functions
- Network tab para verificar suscripciones
- Application tab para Service Worker status

## Deployment y Configuración

### Variables de Entorno Adicionales
```bash
# Notificaciones Push
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:your-email@domain.com

# Supabase (existentes)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiI...
```

### Configuración de Producción
- **HTTPS obligatorio** para push notifications
- **Service Worker** registrado correctamente
- **VAPID keys** configuradas en Supabase
- **Manifest** con permisos de notificación
- **Políticas CSP** actualizadas para push

## Monitoreo y Analytics

### Métricas de Notificaciones
- Tasa de suscripción por rol
- Efectividad de notificaciones (clicks)
- Errores de envío y reintentos
- Preferencias más utilizadas
- Performance de Edge Functions

### Logs Estructurados
```typescript
// Ejemplo de log estructurado
console.log('Push notification sent:', {
  userId,
  type: notification.type,
  title: notification.title,
  timestamp: new Date().toISOString(),
  success: true
});
```

## Roadmap de Notificaciones

### Próximas Implementaciones
1. **Rich Notifications**: Imágenes y botones de acción
2. **Scheduled Notifications**: Programación de envíos
3. **Bulk Notifications**: Envío masivo eficiente
4. **Analytics Dashboard**: Métricas detalladas
5. **Push Templates**: Plantillas personalizables
6. **Silent Push**: Actualizaciones en background

### Integraciones Futuras
- **FCM (Firebase)**: Para aplicaciones móviles nativas
- **APNs (Apple)**: Integración con dispositivos iOS
- **Web Push Protocol**: Estándares avanzados
- **Third-party services**: SendGrid, Pusher, etc.

## Troubleshooting - Notificaciones Push

### Problemas Comunes

#### "Push notifications not supported"
- Verificar navegador compatible (Chrome 50+, Firefox 44+, Safari 16+)
- Confirmar conexión HTTPS
- Revisar Service Worker registration

#### "Permission denied"
- Usuario debe otorgar permisos explícitamente
- Limpiar configuración del sitio en navegador
- Verificar que el dominio no esté bloqueado

#### "Subscription failed"
- Verificar VAPID keys en configuración
- Revisar logs de Edge Functions
- Confirmar que el endpoint esté activo

Esta documentación se mantiene actualizada con cada release del sistema.
