
# Arquitectura del Portal de Clientes

## Vista General del Sistema

El Portal de Clientes sigue una arquitectura moderna basada en React con los siguientes principios:

- **Separación de responsabilidades**: UI, lógica de negocio y estado separados
- **Composición de componentes**: Componentes pequeños y reutilizables
- **Custom Hooks**: Lógica compartida y reutilizable
- **Context API**: Estado global para autenticación y usuario

## Diagrama de Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Components    │    │     Hooks       │    │    Contexts     │
│                 │    │                 │    │                 │
│ PortalLayout    │───▶│ useClientServices│───▶│ UserContext     │
│ PortalHeader    │    │ useServiceRequest│    │ AuthContext     │
│ PortalSidebar   │    │ useSettings     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Pages       │    │   Supabase      │    │   React Router  │
│                 │    │                 │    │                 │
│ PortalDashboard │───▶│ Client Config   │───▶│ Protected Route │
│ PortalServices  │    │ RLS Policies    │    │ Route Guards    │
│ PortalRequest   │    │ Auth System     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Capas de la Aplicación

### 1. Capa de Presentación (UI)
**Ubicación**: `src/components/portal/`, `src/pages/portal/`

**Responsabilidades**:
- Renderizado de interfaces
- Manejo de eventos de usuario
- Presentación de datos
- Navegación entre páginas

**Componentes Principales**:
```typescript
// Layout components
PortalLayout      // Layout principal con sidebar y header
PortalHeader      // Barra superior con info de usuario
PortalSidebar     // Navegación lateral

// Page components  
PortalDashboard   // Dashboard principal
PortalServices    // Lista de servicios
PortalRequestService // Formulario de solicitud
```

### 2. Capa de Lógica de Negocio (Hooks)
**Ubicación**: `src/hooks/portal/`

**Responsabilidades**:
- Lógica de aplicación
- Transformación de datos
- Validaciones
- Comunicación con APIs

**Hooks Principales**:
```typescript
useClientServices     // Gestión de servicios del cliente
useClientInvoices     // Gestión de facturas (futuro)
useServiceRequest     // Creación de solicitudes
useServiceTypesForPortal // Tipos de servicio disponibles
```

### 3. Capa de Estado Global (Contexts)
**Ubicación**: `src/contexts/`

**Responsabilidades**:
- Estado de autenticación
- Información del usuario
- Configuración global
- Notificaciones

**Contexts Utilizados**:
```typescript
AuthContext       // Estado de autenticación
UserContext       // Información del usuario actual
NotificationContext // Sistema de notificaciones
```

### 4. Capa de Datos (Supabase)
**Ubicación**: `src/integrations/supabase/`

**Responsabilidades**:
- Persistencia de datos
- Autenticación y autorización
- Políticas de seguridad (RLS)
- Funciones del servidor

## Flujo de Datos

### 1. Autenticación
```
Usuario → AuthContext → Supabase Auth → UserContext → Portal
```

### 2. Carga de Servicios
```
PortalServices → useClientServices → Supabase → RLS Check → Datos
```

### 3. Solicitud de Servicio
```
PortalRequestService → useServiceRequest → Validación → Supabase → Confirmación
```

## Patrones de Diseño Utilizados

### 1. Custom Hooks Pattern
```typescript
// Encapsula lógica relacionada con servicios
const useClientServices = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const fetchServices = useCallback(async () => {
    // Lógica de fetch
  }, []);
  
  return { services, loading, fetchServices };
};
```

### 2. Compound Component Pattern
```typescript
// PortalLayout como contenedor principal
<PortalLayout>
  <PortalSidebar />
  <main>
    <PortalHeader />
    <Outlet />
  </main>
</PortalLayout>
```

### 3. Provider Pattern
```typescript
// Context providers para estado global
<AuthProvider>
  <UserProvider>
    <NotificationProvider>
      <PortalApp />
    </NotificationProvider>
  </UserProvider>
</AuthProvider>
```

## Seguridad

### Row Level Security (RLS)
Cada tabla tiene políticas que garantizan:

```sql
-- Solo servicios del cliente autenticado
CREATE POLICY "client_services_policy" 
ON services FOR SELECT 
USING (
  client_id IN (
    SELECT client_id FROM profiles 
    WHERE id = auth.uid()
  )
);
```

### Validación de Roles
```typescript
// ProtectedRoute para rutas del portal
<ProtectedRoute requireRole="client">
  <PortalLayout />
</ProtectedRoute>
```

## Optimizaciones de Rendimiento

### 1. Lazy Loading
```typescript
// Carga diferida de componentes
const PortalServices = lazy(() => import('./PortalServices'));
```

### 2. Memoización
```typescript
// Evitar re-renders innecesarios
const memoizedServices = useMemo(() => 
  services.filter(filterLogic), [services, filters]
);
```

### 3. Debouncing
```typescript
// Búsqueda con debounce
const debouncedSearch = useDebounce(searchTerm, 300);
```

## Manejo de Errores

### 1. Error Boundaries
```typescript
// Captura de errores en componentes
<ErrorBoundary>
  <PortalApp />
</ErrorBoundary>
```

### 2. Try-Catch en Hooks
```typescript
const fetchData = async () => {
  try {
    const data = await supabase.from('table').select();
    setData(data);
  } catch (error) {
    console.error('Error:', error);
    toast.error('Error al cargar datos');
  }
};
```

## Testing Strategy

### 1. Unit Tests
- Hooks individuales
- Componentes de presentación
- Funciones utilitarias

### 2. Integration Tests
- Flujos completos
- Interacción entre componentes
- APIs de Supabase

### 3. E2E Tests
- Flujos de usuario completos
- Navegación entre páginas
- Formularios y validaciones

## Deployment

### 1. Build Process
```bash
npm run build  # Construcción para producción
```

### 2. Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. CDN Deployment
- Assets estáticos en CDN
- Optimización de imágenes
- Compresión gzip

## Monitoreo y Métricas

### 1. Error Tracking
- Sentry para errores en producción
- Logs estructurados

### 2. Performance Monitoring
- Core Web Vitals
- Tiempo de carga de páginas
- Métricas de interacción

### 3. User Analytics
- Páginas más visitadas
- Flujos de conversión
- Tiempo en aplicación

---

*Arquitectura diseñada para escalabilidad y mantenibilidad*
*Última actualización: 2025*
