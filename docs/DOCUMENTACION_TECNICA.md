
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
- **Notificaciones**: Sonner
- **Iconos**: Lucide React
- **Email**: Resend API
- **PWA**: Service Workers + Manifest

## Estructura del Proyecto Actualizada

```
src/
├── components/           # Componentes organizados por módulo
│   ├── ui/              # Componentes base de shadcn/ui
│   ├── layout/          # Layouts y navegación
│   ├── operator/        # Módulo de operadores
│   │   ├── PhotographicSet.tsx    # Set fotográfico unificado
│   │   ├── InspectionFormSections.tsx
│   │   ├── SignaturePad.tsx
│   │   └── inspection/  # Subcomponentes de inspección
│   ├── portal/          # Portal de clientes
│   ├── settings/        # Configuraciones del sistema
│   └── ...              # Otros módulos
├── hooks/               # Hooks especializados
│   ├── inspection/      # Hooks de inspecciones
│   │   ├── useInspectionPDF.ts
│   │   ├── useInspectionEmail.ts
│   │   └── useServiceStatusUpdate.ts
│   ├── services/        # Hooks de servicios
│   ├── settings/        # Hooks de configuración
│   └── ...              # Otros hooks
├── utils/               # Utilidades especializadas
│   ├── pdf/            # Generación de PDFs
│   │   ├── pdfPhotos.ts          # Procesamiento de fotos
│   │   ├── photos/               # Utilidades de fotos
│   │   └── sections/             # Secciones del PDF
│   ├── photoProcessor.ts         # Procesamiento de imágenes
│   ├── photoStorage.ts           # Almacenamiento local
│   └── ...              # Otras utilidades
├── schemas/             # Esquemas de validación
│   ├── inspectionSchema.ts       # Schema de inspecciones
│   └── ...              # Otros schemas
└── types/               # Definiciones de tipos
    ├── photo.ts         # Tipos de fotografías
    └── ...              # Otros tipos
```

## Gestión de Estado

### React Query (TanStack Query)
- Cache automático con invalidación inteligente
- Optimistic updates para mejor UX
- Background refetching
- Error handling centralizado
- Loading states automáticos

### Context API
- `AuthContext`: Autenticación y sesión
- `UserContext`: Información del usuario actual
- `NotificationContext`: Sistema de notificaciones

## Base de Datos

### Tablas Principales
- `profiles`: Usuarios con roles y estado
- `clients`: Clientes con información completa
- `operators`: Operadores con licencias
- `cranes`: Flota de grúas
- `service_types`: Tipos de servicios configurables
- `services`: Servicios con estados
- `invoices`: Facturas con tracking
- `service_closures`: Cierres de servicios
- `user_invitations`: Sistema de invitaciones
- `company_data`: Configuración de empresa
- `system_settings`: Configuraciones del sistema
- `calendar_events`: Eventos del calendario

### Row Level Security (RLS)
- Implementado en todas las tablas críticas
- Políticas por rol (admin, operator, client, viewer)
- Funciones de seguridad para operaciones críticas
- Validación de permisos a nivel de base de datos

## Sistema de Inspecciones Rediseñado

### Set Fotográfico Unificado
El sistema de fotos fue completamente rediseñado para unificar todas las fotografías bajo un solo componente:

#### Categorías de Fotos
```typescript
type PhotoCategory = 
  | 'izquierdo'   // Vista izquierda
  | 'derecho'     // Vista derecha  
  | 'frontal'     // Vista frontal
  | 'trasero'     // Vista trasera
  | 'interior'    // Vista interior
  | 'motor'       // Vista motor
```

#### Componente PhotographicSet
- **Interfaz por pestañas**: Una pestaña por categoría
- **Indicadores visuales**: Pestañas verdes cuando contienen foto
- **Validación**: Mínimo 1 foto requerida
- **Almacenamiento local**: Fotos guardadas en localStorage
- **Compresión automática**: Optimización para PDFs

#### Schema de Validación
```typescript
photographicSet: z.array(z.object({
  fileName: z.string().min(1, 'El nombre del archivo es requerido'),
  category: z.enum(['izquierdo', 'derecho', 'frontal', 'trasero', 'interior', 'motor'])
})).refine((value) => value.length > 0, {
  message: "Debes tomar al menos 1 fotografía para el set fotográfico.",
})
```

### Hooks de Inspección

#### useServiceInspection
Hook principal que coordina todo el flujo de inspección:
- Obtención de datos del servicio
- Generación de PDF con progreso
- Envío de email automático
- Actualización de estado del servicio
- Limpieza de fotos del localStorage

#### useInspectionPDF
Manejo de generación de PDFs con progreso:
- Validación de datos
- Procesamiento de fotos
- Generación progresiva
- URLs de descarga
- Limpieza de recursos

#### useInspectionEmail
Envío automático de inspecciones:
- Validación de email del cliente
- Envío con PDF adjunto
- Manejo de errores
- Confirmaciones de entrega

## Generación de PDFs Mejorada

### Procesamiento de Fotos
```typescript
// Función principal para set fotográfico
export const addPhotographicSetSection = async (
  doc: jsPDF, 
  photographicSet: Array<{
    fileName: string;
    category: PhotoCategory;
  }>, 
  yPosition: number
): Promise<number>
```

#### Características:
- **Organización por categorías**: Fotos ordenadas según categorías definidas
- **Compresión inteligente**: Reducción de tamaño para PDFs
- **Layout responsive**: Adaptación automática de espacio
- **Metadata**: Timestamps y información adicional
- **Fallbacks**: Placeholders para fotos faltantes

### Utilidades de Fotos

#### PhotoProcessor
- Validación de formatos de imagen
- Compresión con calidad ajustable
- Redimensionamiento automático
- Conversión a formato base64

#### PhotoStorage
- Almacenamiento en localStorage
- Gestión de memoria
- Limpieza automática
- Recuperación de fotos

## Portal de Clientes

### Arquitectura Independiente
- Autenticación separada del sistema principal
- Rutas específicas (`/portal/*`)
- Contexto de usuario independiente
- API calls específicas para clientes

### Componentes Principales
- `PortalLayout`: Layout específico del portal
- `PortalDashboard`: Dashboard personalizado
- `PortalRequestService`: Solicitud de servicios
- `PortalServices`: Historial de servicios
- `PortalInvoices`: Facturas del cliente

## Sistema de Usuarios con Invitaciones

### Flujo de Invitaciones
1. **Creación**: Admin crea usuario con email
2. **Pre-registro**: Perfil creado en estado 'pending'
3. **Invitación**: Edge function envía email automático
4. **Seguimiento**: Estado actualizado a 'sent'
5. **Registro**: Usuario completa información
6. **Activación**: Estado cambia a 'accepted'

### Edge Function: send-user-invitation
```typescript
// Envío de invitaciones por email
const { data, error } = await supabase.functions.invoke('send-user-invitation', {
  body: {
    userId: 'uuid',
    email: 'user@example.com',
    fullName: 'Usuario Ejemplo',
    role: 'operator',
    clientName: 'Cliente Asociado'
  }
});
```

### Estados de Invitación
- `pending`: Invitación creada, no enviada
- `sent`: Email enviado exitosamente
- `accepted`: Usuario completó registro
- `expired`: Invitación venció sin usar

## Hooks Especializados por Módulo

### Servicios
- `useServices`: CRUD completo con cache
- `useServiceMutations`: Operaciones de modificación
- `useServiceTransformer`: Transformación de datos
- `useServiceFormData`: Manejo de formularios
- `useServiceFormValidation`: Validaciones específicas

### Operadores
- `useOperatorService`: Servicio específico del operador
- `useOperatorServices`: Lista de servicios asignados
- `useOperatorServicesTabs`: Gestión de pestañas

### Portal
- `useClientServices`: Servicios del cliente autenticado
- `useClientInvoices`: Facturas del cliente
- `useServiceRequest`: Solicitud de nuevos servicios

### Configuraciones
- `useUserManagement`: Gestión completa de usuarios
- `useSettings`: Configuración general
- `useSystemSettings`: Configuraciones del sistema

## Validaciones con Zod

### Esquemas Principales
```typescript
// Inspección con set fotográfico unificado
export const inspectionFormSchema = z.object({
  equipment: z.array(z.string()).min(1),
  vehicleObservations: z.string().optional(),
  operatorSignature: z.string().min(1),
  clientSignature: z.string().optional(),
  clientName: z.string().optional(),
  photographicSet: z.array(z.object({
    fileName: z.string().min(1),
    category: z.enum(['izquierdo', 'derecho', 'frontal', 'trasero', 'interior', 'motor'])
  })).min(1, "Debes tomar al menos 1 fotografía")
});
```

## Edge Functions

### Funciones Implementadas
- `send-inspection-email`: Envío de inspecciones con PDF
- `send-user-invitation`: Sistema de invitaciones
- `send-invoice-email`: Envío de facturas
- `send-operator-notification`: Notificaciones a operadores
- `generate-backup`: Respaldos automáticos

### Configuración de Email
- **Proveedor**: Resend API
- **Dominio**: `gruas5norte.cl`
- **Remitente**: `noreply@gruas5norte.cl`
- **Templates**: HTML responsive

## Performance y Optimización

### Optimizaciones Implementadas
- Lazy loading de componentes pesados
- Memoización con React.memo
- Debounce en búsquedas
- Paginación en listados
- Cache inteligente con React Query
- Compresión de imágenes
- Bundle splitting

### Métricas de Performance
- Time to Interactive < 3s
- First Contentful Paint < 1.5s
- Cumulative Layout Shift < 0.1
- Bundle size optimizado

## Seguridad

### Medidas de Seguridad
- Row Level Security completo
- Validación en cliente y servidor
- Sanitización de datos
- Tokens JWT seguros
- HTTPS obligatorio
- Funciones de seguridad 'SECURITY DEFINER'

### Sistema de Invitaciones Seguro
- Validación de email y unicidad
- Tokens seguros en enlaces
- Expiración controlada
- Dominio verificado

## PWA (Progressive Web App)

### Funcionalidades PWA
- Service Worker con cache inteligente
- Manifest para instalación
- Soporte offline básico
- Notificaciones push (futuro)

### Componentes PWA
- `PWAWrapper`: Contenedor principal
- `InstallPrompt`: Prompt de instalación
- `UpdateNotification`: Notificaciones de actualización
- `ConnectionStatus`: Estado de conexión

## Testing

### Estrategia de Testing
- Unit tests para utilidades críticas
- Integration tests para flujos principales
- E2E tests para casos de uso críticos
- Testing de Edge Functions

## Deployment

### Variables de Entorno
```bash
# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiI...

# Email
RESEND_API_KEY=re_...

# Aplicación
SITE_URL=https://tu-dominio.com
```

### Configuración de Producción
- Build optimizado con Vite
- Compresión gzip
- CDN para assets
- Health checks
- Variables seguras

## Monitoreo

### Métricas Trackeadas
- Errores de aplicación con contexto
- Performance de queries
- Tiempo de respuesta de funciones
- Uso de recursos
- Estados de invitaciones

### Logs Estructurados
- Errores categorizados por módulo
- Eventos de auditoría
- Performance metrics
- Logs de Edge Functions con contexto

## Funcionalidades Recientes

### Set Fotográfico Unificado (v2.0)
- Migración de 3 sets independientes a 1 unificado
- 6 categorías específicas de fotos
- Interfaz por pestañas mejorada
- Validación simplificada (mínimo 1 foto)
- Integración completa con PDFs

### Sistema de Invitaciones
- Pre-registro de usuarios
- Emails automáticos con plantillas HTML
- Control de estados en tiempo real
- Reenvío de invitaciones
- Integración con Resend API

### Portal de Clientes Avanzado
- Autenticación independiente
- Dashboard personalizado
- Solicitud de servicios integrada
- Acceso a inspecciones completas

## Roadmap Técnico

### Próximas Implementaciones
1. **WebSockets**: Updates en tiempo real
2. **Push Notifications**: Notificaciones nativas
3. **Offline-first**: Funcionalidad completa sin conexión
4. **Multi-tenancy**: Soporte múltiples empresas
5. **Advanced Analytics**: Dashboard analítico
6. **Mobile App**: Aplicación nativa
7. **API REST**: API pública para integraciones

### Deuda Técnica
- Refactorización de componentes > 300 líneas
- Mejora de tipos TypeScript
- Aumento de cobertura de tests
- Implementación de Error Boundaries
- Bundle splitting más granular

## Convenciones de Código

### Naming Conventions
- **Componentes**: PascalCase (`PhotographicSet`)
- **Hooks**: camelCase con 'use' (`useServiceInspection`)
- **Variables**: camelCase (`isPhotoValid`)
- **Constantes**: UPPER_SNAKE_CASE (`PHOTO_CATEGORIES`)
- **Archivos**: kebab-case (`photographic-set.tsx`)
- **Tipos**: PascalCase (`PhotoCategory`)

### Patrones Arquitectónicos
- Hooks personalizados para lógica reutilizable
- Componentes funcionales únicamente
- Error handling con try-catch en operaciones críticas
- Loading states consistentes
- Separación clara de responsabilidades

## Debugging y Troubleshooting

### Tools de Debug
- React Developer Tools
- React Query DevTools
- Supabase Dashboard
- Network Analysis
- Console logs estructurados

### Problemas Comunes y Soluciones
1. **Tipos TypeScript**: Verificar compatibilidad de tipos
2. **RLS Policies**: Revisar políticas de seguridad
3. **Email Delivery**: Validar configuración Resend
4. **Photo Processing**: Verificar formatos y tamaños
5. **Cache Issues**: Invalidar queries de React Query

Esta documentación se mantiene actualizada con cada release del sistema.
