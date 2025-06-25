
# Documentación Técnica - TMS Grúas

## Arquitectura del Sistema

### Tecnologías Principales
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Estado**: React Query (TanStack Query) + Context API
- **Enrutamiento**: React Router DOM
- **Validación**: Zod
- **PDF Generation**: jsPDF + jsPDF AutoTable
- **Excel Export**: XLSX
- **Notificaciones**: Sonner
- **Iconos**: Lucide React
- **Email**: Resend API

## Estructura del Proyecto

```
src/
├── components/           # Componentes reutilizables organizados por módulo
│   ├── ui/              # Componentes base de shadcn/ui
│   ├── layout/          # Componentes de diseño (Header, Sidebar, etc.)
│   ├── services/        # Componentes específicos de servicios
│   ├── clients/         # Componentes de gestión de clientes
│   ├── operators/       # Componentes del módulo de operadores
│   ├── portal/          # Componentes del portal de clientes
│   ├── settings/        # Componentes de configuración del sistema
│   └── ...              # Otros módulos
├── hooks/               # Hooks personalizados organizados por funcionalidad
│   ├── services/        # Hooks relacionados con servicios
│   ├── inspection/      # Hooks de inspecciones
│   ├── settings/        # Hooks de configuración
│   └── ...              # Otros módulos
├── pages/               # Páginas principales de la aplicación
├── contexts/            # Contextos de React para estado global
├── types/               # Definiciones de tipos TypeScript
├── utils/               # Utilidades y funciones auxiliares
├── schemas/             # Esquemas de validación con Zod
└── integrations/        # Integraciones externas (Supabase)
```

## Gestión de Estado

### React Query
- Manejo de estado servidor con cache automático
- Invalidación inteligente de queries
- Manejo de loading states y errores
- Optimistic updates para mejor UX

### Context API
- `AuthContext`: Autenticación y sesión del usuario
- `UserContext`: Información del usuario actual
- `NotificationContext`: Sistema de notificaciones

## Base de Datos

### Tablas Principales
- `profiles`: Usuarios del sistema con roles
- `clients`: Clientes de la empresa
- `operators`: Operadores de grúas
- `cranes`: Grúas disponibles
- `service_types`: Tipos de servicios configurables
- `services`: Servicios realizados
- `invoices`: Facturas generadas
- `service_closures`: Cierres de servicios
- `user_invitations`: Sistema de invitaciones por email
- `company_data`: Configuración de la empresa
- `system_settings`: Configuraciones del sistema
- `backup_logs`: Registro de respaldos automáticos
- `calendar_events`: Eventos del calendario integrado

### Políticas RLS (Row Level Security)
- Implementadas para todos los módulos
- Separación por roles (admin, operator, client, viewer)
- Políticas específicas para lectura/escritura por usuario
- Funciones de seguridad para validación de roles

### Funciones de Base de Datos
- `admin_create_user`: Creación de usuarios por administradores
- `get_all_users`: Obtención de usuarios con información completa
- `update_user_role`: Actualización de roles de usuario
- `toggle_user_status`: Activación/desactivación de usuarios
- `validate_email`: Validación de formato de email
- `get_client_id_for_user`: Obtención de cliente asociado a usuario

## Sistema de Gestión de Usuarios

### Creación de Usuarios
- **Flujo de Pre-registro**: Los administradores pueden crear usuarios sin que estos tengan cuenta en Auth
- **Sistema de Invitaciones**: Envío automático de emails con enlaces de registro
- **Configuración de Roles**: Asignación previa de roles (admin, operator, viewer, client)
- **Asociación de Clientes**: Vinculación automática de usuarios tipo 'client' con empresas

### Estados de Invitación
- **Pending**: Invitación creada, email por enviar
- **Sent**: Email enviado exitosamente
- **Accepted**: Usuario completó su registro
- **Expired**: Invitación venció sin usar

### Funcionalidades Avanzadas
- **Reenvío de Invitaciones**: Capacidad de reenviar emails de invitación
- **Gestión de Estados**: Control granular del estado de cada usuario
- **Validaciones**: Verificación de emails únicos y datos requeridos

## Hooks Especializados

### Servicios
- `useServices`: CRUD completo de servicios
- `useServiceFetcher`: Obtención optimizada de servicios
- `useServiceMutations`: Operaciones de creación/actualización/eliminación
- `useServiceTransformer`: Transformación de datos de la BD a tipos TS
- `useServiceFormData`: Manejo de formularios de servicios
- `useServiceFormValidation`: Validaciones específicas
- `useServiceFormSubmission`: Lógica de envío de formularios

### Gestión de Usuarios
- `useUserManagement`: Hook principal para gestión completa de usuarios
  - Creación de usuarios con pre-registro
  - Envío automático de invitaciones por email
  - Gestión de roles y permisos
  - Control de estados de usuarios
  - Reenvío de invitaciones

### Inspecciones
- `useServiceInspection`: Hook principal para inspecciones
- `useInspectionPDF`: Generación de PDFs de inspección
- `useInspectionEmail`: Envío de inspecciones por email
- `useServiceStatusUpdate`: Actualización de estados de servicios

### Portal de Clientes
- `useClientServices`: Servicios del cliente autenticado
- `useClientInvoices`: Facturas del cliente
- `useServiceRequest`: Solicitud de nuevos servicios

### Configuraciones
- `useSettings`: Configuración general del sistema
- `useSystemSettings`: Configuraciones específicas del sistema
- `useSettingsFetcher`: Obtención de configuraciones
- `useSettingsSaver`: Guardado de configuraciones

## Validaciones

### Esquemas Zod
- `serviceSchema`: Validación de servicios
- `inspectionSchema`: Validación de inspecciones
- `costSchema`: Validación de costos
- `portalRequestServiceSchema`: Validación de solicitudes del portal
- `portalAuthSchema`: Validación de autenticación del portal

## Generación de Documentos

### PDFs
- Inspecciones con fotos y firmas digitales
- Reportes de servicios detallados
- Facturas profesionales
- Compresión automática de imágenes

### Excel
- Exportación de servicios con filtros
- Reportes financieros detallados
- Análisis de costos por período
- Plantillas configurables

## Autenticación y Autorización

### Roles del Sistema
- `admin`: Acceso completo al sistema y gestión de usuarios
- `operator`: Acceso a módulos operativos y servicios
- `client`: Acceso exclusivo al portal de clientes
- `viewer`: Solo lectura en módulos permitidos

### Sistema de Invitaciones
- **Pre-registro**: Creación de perfiles antes del registro completo
- **Emails Automáticos**: Envío de invitaciones con enlaces personalizados
- **Seguimiento**: Control del estado de cada invitación
- **Reenvío**: Capacidad de reenviar invitaciones no utilizadas

### Flujos de Autenticación
1. **Registro Normal**: Usuario se registra directamente
2. **Registro por Invitación**: Usuario completa registro desde email de invitación
3. **Verificación de Rol**: Asignación automática de rol pre-configurado
4. **Redirección**: Direccionamiento según permisos del usuario

## API y Edge Functions

### Funciones Implementadas
- `send-inspection-email`: Envío de inspecciones por email con PDFs
- `send-invoice-email`: Envío de facturas a clientes
- `send-operator-notification`: Notificaciones a operadores
- `send-user-invitation`: **NUEVA** - Sistema completo de invitaciones
  - Generación de emails HTML responsivos
  - Enlaces de registro pre-llenados
  - Integración con Resend API
  - Actualización automática de estados
- `generate-backup`: Generación de respaldos del sistema

### Configuración de Email
- **Proveedor**: Resend API
- **Dominio Verificado**: `gruas5norte.cl`
- **Remitente**: `noreply@gruas5norte.cl`
- **Templates**: HTML responsive con estilos inline

## Módulo de Configuraciones

### Gestión de Empresa
- **Datos Básicos**: Nombre, RUT, dirección, contacto
- **Logo**: Subida y gestión de logotipo empresarial
- **Configuraciones Legales**: Textos legales para documentos
- **Parámetros Financieros**: IVA, días de vencimiento

### Gestión de Usuarios
- **Vista Completa**: Lista de todos los usuarios del sistema
- **Creación Avanzada**: Formulario de creación con validaciones
- **Gestión de Roles**: Cambio dinámico de roles de usuario
- **Estados**: Activación/desactivación de usuarios
- **Invitaciones**: Control completo del sistema de invitaciones

### Configuraciones del Sistema
- **Notificaciones**: Control de tipos de notificaciones
- **Respaldos**: Configuración de respaldos automáticos
- **Mantenimiento**: Modo de mantenimiento del sistema
- **Retención de Datos**: Configuración de políticas de retención

## Performance

### Optimizaciones Implementadas
- Lazy loading de componentes pesados
- Memoización con React.memo en componentes críticos
- Debounce en búsquedas y filtros
- Paginación en todos los listados grandes
- Cache inteligente con React Query
- Compresión de imágenes en PDFs

### Métricas de Performance
- Time to Interactive < 3s
- First Contentful Paint < 1.5s
- Cumulative Layout Shift < 0.1
- Bundle size optimizado

## Seguridad

### Medidas Implementadas
- Row Level Security completo en Supabase
- Validación de entrada en cliente y servidor
- Sanitización de datos en formularios
- Tokens JWT seguros con expiración
- HTTPS obligatorio en producción
- Funciones de seguridad definer para operaciones críticas

### Sistema de Invitaciones Seguro
- **Validación de Email**: Verificación de formato y unicidad
- **Tokens Seguros**: Enlaces con parámetros encriptados
- **Expiración**: Control de tiempo de vida de invitaciones
- **Dominio Verificado**: Solo emails desde dominio autorizado

## PWA (Progressive Web App)

### Funcionalidades PWA
- **Service Worker**: Cache inteligente de recursos
- **Manifest**: Configuración para instalación en dispositivos
- **Offline Support**: Funcionalidad básica sin conexión
- **Push Notifications**: Notificaciones push (futuro)

### Componentes PWA
- `PWAWrapper`: Contenedor principal de funcionalidades PWA
- `InstallPrompt`: Prompt de instalación personalizado
- `UpdateNotification`: Notificaciones de actualizaciones
- `ConnectionStatus`: Indicador de estado de conexión

## Testing

### Estrategia de Testing
- Unit tests para utilidades críticas
- Integration tests para flujos de usuario
- E2E tests para casos de uso principales
- Testing de Edge Functions con mocks

## Deployment

### Configuración de Producción
- Build optimizado con Vite
- Compresión gzip automática
- CDN para assets estáticos
- Health checks automáticos
- Variables de entorno seguras

### Variables de Entorno Requeridas
```bash
# Supabase
SUPABASE_URL=https://jqszxljtfuknhuvuheko.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=[Clave de servicio]

# Email
RESEND_API_KEY=[Clave de Resend]

# Aplicación
SITE_URL=[URL de la aplicación en producción]
```

## Monitoreo

### Métricas Trackeadas
- Errores de aplicación con stack traces
- Performance de queries de base de datos
- Tiempo de respuesta de Edge Functions
- Uso de recursos del servidor
- Estados de invitaciones de usuarios

### Logs Estructurados
- Errores categorizados por módulo
- Eventos de auditoría de usuarios
- Performance metrics por página
- Logs de Edge Functions con contexto

## Funcionalidades Avanzadas Implementadas

### Sistema de Calendario
- **Vista Múltiple**: Mes, semana, día
- **Eventos Integrados**: Servicios, inspecciones, vencimientos
- **Filtros Avanzados**: Por tipo, cliente, operador
- **Navegación Intuitiva**: Controles de fecha optimizados

### Portal de Clientes
- **Autenticación Separada**: Sistema de login independiente
- **Dashboard Personalizado**: Métricas específicas del cliente
- **Solicitud de Servicios**: Formulario avanzado con validaciones
- **Historial Completo**: Servicios e inspecciones del cliente

### Sistema de Respaldos
- **Respaldos Automáticos**: Configurables por frecuencia
- **Compresión**: Reducción del tamaño de respaldos
- **Historial**: Registro completo de respaldos realizados
- **Restauración**: Capacidad de restaurar datos (futuro)

## Roadmap Técnico

### Próximas Mejoras Planificadas
1. **Real-time Updates**: WebSockets para actualizaciones en tiempo real
2. **Push Notifications**: Notificaciones push móviles
3. **Offline-first**: Funcionalidad completa sin conexión
4. **Multi-tenancy**: Soporte para múltiples empresas
5. **Advanced Analytics**: Dashboard analítico avanzado
6. **Mobile App**: Aplicación móvil nativa
7. **API REST**: API pública para integraciones

### Deuda Técnica Identificada
- **Refactorización**: Componentes de más de 300 líneas necesitan división
- **Tipos TypeScript**: Mejora de tipos en algunos módulos
- **Testing**: Aumentar cobertura de tests automatizados
- **Error Boundaries**: Implementación en componentes críticos
- **Bundle Splitting**: División más granular del código

## Integración con Servicios Externos

### Resend Email Service
- **Configuración**: API key y dominio verificado
- **Templates**: Emails HTML responsive
- **Tracking**: Seguimiento de entregas y aperturas
- **Límites**: Control de rate limiting

### Supabase Backend
- **Database**: PostgreSQL con extensiones
- **Auth**: Autenticación JWT completa
- **Storage**: Almacenamiento de archivos (futuro)
- **Edge Functions**: Lógica serverless
- **Real-time**: Subscripciones en tiempo real (futuro)

## Convenciones de Código

### Naming Conventions
- **Componentes**: PascalCase (`UserManagementTab`)
- **Hooks**: camelCase con prefijo 'use' (`useUserManagement`)
- **Variables**: camelCase (`isUserActive`)
- **Constantes**: UPPER_SNAKE_CASE (`RESEND_API_KEY`)
- **Archivos**: kebab-case (`user-management-tab.tsx`)
- **Tipos**: PascalCase (`UserInvitation`)

### Estructura de Archivos
- **Un componente por archivo**: Máximo 300 líneas
- **Index files**: Para exports organizados
- **Co-location**: Archivos relacionados juntos
- **Separación de concerns**: UI, lógica, tipos separados

### Patrones de Código
- **Hooks personalizados**: Para lógica reutilizable
- **Componentes funcionales**: Solo con hooks
- **Error handling**: Try-catch en operaciones críticas
- **Loading states**: Indicadores de carga consistentes

## Troubleshooting Común

### Problemas de Build
1. **Dependencias**: Verificar versiones compatibles
2. **Tipos TypeScript**: Resolver conflictos de tipos
3. **Import paths**: Verificar rutas de importación
4. **Bundle size**: Optimizar imports grandes

### Problemas de Base de Datos
1. **RLS Policies**: Verificar políticas de seguridad
2. **Migraciones**: Ejecutar migraciones pendientes
3. **Conexiones**: Verificar límites de conexiones
4. **Performance**: Optimizar queries lentas

### Problemas de Email
1. **API Key**: Verificar configuración de Resend
2. **Dominio**: Confirmar verificación del dominio
3. **Rate Limits**: Verificar límites de envío
4. **Templates**: Validar HTML de emails

### Debugging Tools
- **React Developer Tools**: Debug de componentes
- **React Query DevTools**: Debug de cache y queries
- **Supabase Dashboard**: Logs y métricas
- **Network Tab**: Análisis de requests
- **Console Logs**: Logs estructurados por módulo

## Métricas y KPIs

### Métricas Técnicas
- **Uptime**: > 99.9%
- **Response Time**: < 2s promedio
- **Error Rate**: < 0.1%
- **Bundle Size**: < 2MB inicial

### Métricas de Usuario
- **User Engagement**: Tiempo en aplicación
- **Feature Adoption**: Uso de nuevas funcionalidades
- **User Satisfaction**: Feedback y reportes
- **Support Tickets**: Reducción de problemas reportados

## Documentación de APIs

### Supabase Edge Functions
```typescript
// Ejemplo de llamada a función de invitación
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

### React Query Patterns
```typescript
// Patrón estándar para queries
const { data, isLoading, error } = useQuery({
  queryKey: ['users', filters],
  queryFn: () => fetchUsers(filters),
  staleTime: 5 * 60 * 1000, // 5 minutos
});
```

Esta documentación se mantendrá actualizada con cada nueva funcionalidad implementada en el sistema.
