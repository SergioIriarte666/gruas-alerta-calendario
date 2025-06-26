
# Portal de Clientes - TMS Grúas

## Descripción General

El Portal de Clientes es una interfaz web dedicada que permite a los clientes de la empresa de grúas acceder a sus servicios, solicitar nuevos servicios y consultar su historial de manera autónoma.

## Características Principales

### 🔐 Autenticación Segura
- Sistema de login basado en Supabase Auth
- Roles específicos para clientes (`client`)
- Protección de rutas mediante `ProtectedRoute`

### 📊 Dashboard
- Vista general de servicios activos
- Estadísticas personalizadas del cliente
- Acceso rápido a funciones principales

### 🚛 Gestión de Servicios
- **Mis Servicios**: Historial completo de servicios solicitados
- **Solicitar Servicio**: Formulario para nuevas solicitudes
- **Estado de Servicios**: Seguimiento en tiempo real

### 🎨 Interfaz de Usuario
- Diseño responsivo con Tailwind CSS
- Tema oscuro optimizado para uso profesional
- Navegación intuitiva con sidebar colapsible

## Estructura de Archivos

```
src/
├── components/portal/
│   └── layout/
│       ├── PortalLayout.tsx      # Layout principal del portal
│       ├── PortalHeader.tsx      # Encabezado con info de usuario
│       └── PortalSidebar.tsx     # Navegación lateral
├── pages/portal/
│   ├── PortalDashboard.tsx       # Página principal del portal
│   ├── PortalServices.tsx        # Lista de servicios del cliente
│   └── PortalRequestService.tsx  # Formulario de solicitud
└── hooks/portal/
    ├── useClientServices.ts      # Hook para servicios del cliente
    ├── useClientInvoices.ts      # Hook para facturas (pendiente)
    └── useServiceRequest.ts      # Hook para solicitudes
```

## Rutas del Portal

### Rutas Principales
- `/portal` - Redirección al dashboard
- `/portal/dashboard` - Dashboard principal
- `/portal/services` - Mis servicios
- `/portal/request-service` - Solicitar nuevo servicio

### Rutas Ocultas Temporalmente
- `/portal/invoices` - Facturas (oculta hasta integración fiscal)

## Configuración de Seguridad

### Row Level Security (RLS)
Todas las consultas del portal están protegidas por políticas RLS que garantizan:
- Los clientes solo ven sus propios datos
- No pueden acceder a información de otros clientes
- Permisos específicos por tabla

### Ejemplo de Política RLS
```sql
CREATE POLICY "Clients can view own services" 
ON services FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.client_id = services.client_id
  )
);
```

## Funcionalidades por Página

### Dashboard (`/portal/dashboard`)
- **Resumen de servicios**: Contadores de servicios por estado
- **Servicios recientes**: Lista de últimos servicios
- **Accesos rápidos**: Botones para acciones frecuentes

### Mis Servicios (`/portal/services`)
- **Lista filtrable**: Servicios con búsqueda y filtros
- **Detalles del servicio**: Modal con información completa
- **Estados visuales**: Badges de colores por estado
- **Paginación**: Navegación por páginas de resultados

### Solicitar Servicio (`/portal/request-service`)
- **Formulario dinámico**: Campos que cambian según tipo de servicio
- **Validación completa**: Validación en tiempo real
- **Tipos de servicio**: Selección de servicios disponibles
- **Información del vehículo**: Datos completos del vehículo

## Hooks Personalizados

### `useClientServices`
```typescript
const { 
  services, 
  loading, 
  error, 
  refetch 
} = useClientServices();
```

### `useServiceRequest`
```typescript
const { 
  submitRequest, 
  loading, 
  serviceTypes 
} = useServiceRequest();
```

## Estados de Servicios

### Estados Visibles para Clientes
- `pending` - Pendiente
- `in_progress` - En progreso
- `completed` - Completado
- `invoiced` - Facturado

### Colores por Estado
- Pendiente: `bg-yellow-100 text-yellow-800`
- En progreso: `bg-blue-100 text-blue-800`
- Completado: `bg-green-100 text-green-800`
- Facturado: `bg-purple-100 text-purple-800`

## Integración con Backend

### Autenticación
- Utiliza Supabase Auth para gestión de usuarios
- Context `UserContext` para estado global del usuario
- Context `AuthContext` para autenticación

### Base de Datos
- Tabla `profiles` para información de usuarios
- Tabla `clients` para datos de clientes
- Tabla `services` para servicios
- Políticas RLS para seguridad

## Personalización Visual

### Tema
- Colores principales: Gris oscuro (`gray-800`, `gray-900`)
- Color de acento: Verde TMS (`tms-green`)
- Tipografía: Sistema por defecto de Tailwind

### Logo de Empresa
- Configurable desde `useSettings`
- Fallback a icono por defecto
- Dimensiones optimizadas: 32x32px

## Mantenimiento y Actualizaciones

### Características Pendientes
- ❌ Facturas (requiere integración fiscal)
- ⏳ Notificaciones push
- ⏳ Chat en vivo con operadores
- ⏳ Descarga de documentos

### Consideraciones Técnicas
- Mantener compatibilidad con roles existentes
- Optimizar consultas para clientes con muchos servicios
- Implementar caché para mejor rendimiento

## Troubleshooting

### Problemas Comunes

**Error 404 en navegación**
- Verificar que todas las rutas estén definidas en App.tsx
- Usar `Link` de React Router en lugar de `<a href>`

**Usuario no puede ver servicios**
- Verificar que `client_id` esté configurado en perfil
- Revisar políticas RLS en tabla services

**Error de autenticación**
- Verificar token de Supabase
- Comprobar configuración de rol 'client'

### Logs Útiles
```javascript
// Verificar usuario actual
console.log('Current user:', user);

// Verificar servicios cargados
console.log('Services loaded:', services.length);

// Verificar filtros aplicados
console.log('Active filters:', { searchTerm, statusFilter });
```

## Próximos Pasos

1. **Integración Fiscal**: Implementar facturas con sello fiscal
2. **Notificaciones**: Sistema de notificaciones en tiempo real
3. **Móvil**: Optimización para dispositivos móviles
4. **PWA**: Convertir en Progressive Web App
5. **Analytics**: Métricas de uso del portal

---

*Documentación actualizada: $(date)*
*Versión del sistema: 2.0*
