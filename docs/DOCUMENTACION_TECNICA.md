
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
│   └── ...              # Otros módulos
├── hooks/               # Hooks personalizados organizados por funcionalidad
│   ├── services/        # Hooks relacionados con servicios
│   ├── inspection/      # Hooks de inspecciones
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
- `profiles`: Usuarios del sistema
- `clients`: Clientes de la empresa
- `operators`: Operadores de grúas
- `cranes`: Grúas disponibles
- `service_types`: Tipos de servicios
- `services`: Servicios realizados
- `invoices`: Facturas generadas
- `service_closures`: Cierres de servicios

### Políticas RLS (Row Level Security)
- Implementadas para todos los módulos
- Separación por roles (admin, operator, client, viewer)
- Políticas específicas para lectura/escritura

## Hooks Especializados

### Servicios
- `useServices`: CRUD completo de servicios
- `useServiceFetcher`: Obtención optimizada de servicios
- `useServiceMutations`: Operaciones de creación/actualización/eliminación
- `useServiceTransformer`: Transformación de datos de la BD a tipos TS
- `useServiceFormData`: Manejo de formularios de servicios
- `useServiceFormValidation`: Validaciones específicas
- `useServiceFormSubmission`: Lógica de envío de formularios

### Inspecciones
- `useServiceInspection`: Hook principal para inspecciones
- `useInspectionPDF`: Generación de PDFs de inspección
- `useInspectionEmail`: Envío de inspecciones por email
- `useServiceStatusUpdate`: Actualización de estados de servicios

### Portal de Clientes
- `useClientServices`: Servicios del cliente autenticado
- `useClientInvoices`: Facturas del cliente
- `useServiceRequest`: Solicitud de nuevos servicios

## Validaciones

### Esquemas Zod
- `serviceSchema`: Validación de servicios
- `inspectionSchema`: Validación de inspecciones
- `costSchema`: Validación de costos
- `portalRequestServiceSchema`: Validación de solicitudes del portal

## Generación de Documentos

### PDFs
- Inspecciones con fotos y firmas
- Reportes de servicios
- Facturas (futuro)

### Excel
- Exportación de servicios
- Reportes financieros
- Análisis de costos

## Autenticación y Autorización

### Roles del Sistema
- `admin`: Acceso completo al sistema
- `operator`: Acceso a módulos de operador
- `client`: Acceso al portal de clientes
- `viewer`: Solo lectura

### Flujos de Autenticación
1. Login con email/password
2. Verificación de rol
3. Redirección según permisos
4. Mantenimiento de sesión

## API y Edge Functions

### Funciones Implementadas
- `send-inspection-email`: Envío de inspecciones por email
- `send-invoice-email`: Envío de facturas
- `send-operator-notification`: Notificaciones a operadores
- `generate-backup`: Generación de respaldos

## Performance

### Optimizaciones Implementadas
- Lazy loading de componentes
- Memoización con React.memo
- Debounce en búsquedas
- Paginación en listados
- Cache inteligente con React Query

### Métricas de Performance
- Time to Interactive < 3s
- First Contentful Paint < 1.5s
- Cumulative Layout Shift < 0.1

## Seguridad

### Medidas Implementadas
- Row Level Security en Supabase
- Validación de entrada en cliente y servidor
- Sanitización de datos
- Tokens JWT seguros
- HTTPS obligatorio

## Testing

### Estrategia de Testing
- Unit tests para utils y hooks
- Integration tests para flujos críticos
- E2E tests para casos de uso principales

## Deployment

### Configuración de Producción
- Build optimizado con Vite
- Compresión gzip
- CDN para assets estáticos
- Health checks automáticos

### Variables de Entorno
```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_RESEND_API_KEY=
```

## Monitoreo

### Métricas Trackeadas
- Errores de aplicación
- Performance de queries
- Tiempo de respuesta de APIs
- Uso de recursos

### Logs
- Errores estructurados
- Eventos de auditoría
- Performance metrics
- User actions

## Roadmap Técnico

### Próximas Mejoras
1. Service Workers para offline support
2. Push notifications
3. Real-time updates con websockets
4. Migración a React Server Components
5. Implementación de micro-frontends

### Deuda Técnica
- Refactorización de componentes largos
- Mejora de tipos TypeScript
- Optimización de queries N+1
- Implementación de error boundaries

## Convenciones de Código

### Naming Conventions
- Componentes: PascalCase
- Hooks: camelCase con prefijo 'use'
- Variables: camelCase
- Constantes: UPPER_SNAKE_CASE
- Archivos: kebab-case

### Estructura de Archivos
- Un componente por archivo
- Index files para exports
- Co-location de archivos relacionados
- Separación clara de concerns

## Troubleshooting

### Problemas Comunes
1. **Build failures**: Verificar dependencias y tipos TS
2. **Query errors**: Revisar políticas RLS
3. **Auth issues**: Validar tokens y roles
4. **Performance**: Analizar re-renders innecesarios

### Debugging
- React Developer Tools
- React Query DevTools
- Supabase logs
- Network tab analysis
