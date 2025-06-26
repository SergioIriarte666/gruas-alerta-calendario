
# Portal de Clientes - TMS Grúas

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js 18+
- Cuenta de Supabase configurada
- Variables de entorno configuradas

### Instalación
```bash
# Clonar el repositorio
git clone [repository-url]

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local

# Iniciar en modo desarrollo
npm run dev
```

## 🏗️ Arquitectura

### Estructura del Proyecto
```
src/
├── components/portal/          # Componentes específicos del portal
│   └── layout/                # Layout components
├── pages/portal/              # Páginas del portal  
├── hooks/portal/              # Custom hooks del portal
├── contexts/                  # React contexts
└── integrations/supabase/     # Configuración de Supabase
```

### Tecnologías Utilizadas
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Routing**: React Router v6
- **Backend**: Supabase (Auth, Database, RLS)
- **State Management**: React Context + Custom Hooks
- **Forms**: React Hook Form + Zod validation
- **UI Components**: Shadcn/ui
- **Icons**: Lucide React

## 🔑 Características Principales

### ✅ Implementado
- [x] Autenticación segura con Supabase
- [x] Dashboard con métricas personalizadas
- [x] Lista de servicios con filtros y búsqueda
- [x] Formulario de solicitud de servicios
- [x] Navegación responsive
- [x] Tema oscuro optimizado
- [x] Políticas RLS para seguridad
- [x] Manejo de errores comprehensive

### ⏳ En Desarrollo
- [ ] Sistema de facturas (pendiente integración fiscal)
- [ ] Notificaciones push
- [ ] Chat en vivo
- [ ] Descarga de documentos PDF

### 🚫 Temporalmente Oculto
- Módulo de facturas (comentado hasta integración fiscal)

## 🔐 Seguridad

### Row Level Security (RLS)
Todas las consultas están protegidas por políticas RLS:

```sql
-- Ejemplo: Clientes solo ven sus servicios
CREATE POLICY "client_own_services" ON services
FOR SELECT USING (
  client_id IN (
    SELECT client_id FROM profiles 
    WHERE id = auth.uid()
  )
);
```

### Protección de Rutas
```typescript
// Solo usuarios con rol 'client' pueden acceder
<ProtectedRoute requireRole="client">
  <PortalLayout />
</ProtectedRoute>
```

## 📱 Páginas del Portal

### Dashboard (`/portal/dashboard`)
- **Métricas**: Servicios activos, completados, pendientes
- **Accesos rápidos**: Botones para acciones frecuentes
- **Servicios recientes**: Lista de últimos servicios

### Mis Servicios (`/portal/services`)
- **Lista completa**: Todos los servicios del cliente
- **Filtros avanzados**: Por estado, fecha, tipo
- **Búsqueda**: Por folio, patente, marca
- **Detalles**: Modal con información completa

### Solicitar Servicio (`/portal/request-service`)
- **Formulario dinámico**: Campos que cambian según tipo
- **Validación en tiempo real**: Con Zod schema
- **Selección de tipos**: Servicios disponibles
- **Información vehicular**: Datos completos

## 🎯 Custom Hooks

### `useClientServices`
```typescript
const { 
  services,        // Array de servicios
  loading,         // Estado de carga
  error,          // Errores si los hay
  refetch         // Función para recargar
} = useClientServices();
```

### `useServiceRequest`
```typescript
const { 
  submitRequest,   // Función para enviar solicitud
  loading,         // Estado de envío
  serviceTypes,    // Tipos de servicio disponibles
  success         // Estado de éxito
} = useServiceRequest();
```

## 🎨 Tema y Estilos

### Paleta de Colores
```css
/* Principales */
--tms-green: #10B981;        /* Color corporativo */
--gray-900: #111827;         /* Fondo principal */
--gray-800: #1F2937;         /* Fondo secundario */
--gray-700: #374151;         /* Bordes */

/* Estados */
--yellow-100: #FEF3C7;       /* Pendiente */
--blue-100: #DBEAFE;         /* En progreso */
--green-100: #D1FAE5;        /* Completado */
--purple-100: #E9D5FF;       /* Facturado */
```

### Componentes de UI
Basados en Shadcn/ui con personalizaciones:
- `Button`: Estilos corporativos
- `Card`: Bordes redondeados y sombras
- `Badge`: Estados de servicios
- `Dialog`: Modales y formularios

## 📊 Manejo de Estado

### Context Providers
```typescript
// Estructura de providers
<AuthProvider>          // Autenticación
  <UserProvider>        // Usuario actual
    <NotificationProvider>  // Notificaciones
      <PortalApp />
    </NotificationProvider>
  </UserProvider>
</AuthProvider>
```

### Estado Local
- `useState` para estado de componente
- `useReducer` para lógica compleja
- Custom hooks para lógica compartida

## 🚀 Performance

### Optimizaciones Implementadas
- **Lazy Loading**: Componentes cargados bajo demanda
- **Memoización**: `useMemo` y `useCallback` estratégicos
- **Debouncing**: Búsquedas con retraso de 300ms
- **Paginación**: 10 elementos por página

### Métricas Objetivo
- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1

## 🐛 Debugging

### Logs Útiles
```javascript
// En desarrollo
console.log('User:', user);
console.log('Services:', services);
console.log('Filters:', filters);

// En producción (usar con moderación)
console.error('Critical error:', error);
```

### Herramientas de Debug
- React Developer Tools
- Supabase Dashboard
- Network tab para APIs
- Console logs estructurados

## 🧪 Testing

### Setup de Testing
```bash
# Ejecutar tests
npm run test

# Coverage report
npm run test:coverage

# E2E tests
npm run test:e2e
```

### Estructura de Tests
```
__tests__/
├── components/
├── hooks/
├── pages/
└── utils/
```

## 📈 Monitoreo

### Métricas Clave
- **Autenticación**: Tasa de login exitoso
- **Servicios**: Solicitudes completadas
- **Errores**: Rate de errores por página
- **Performance**: Tiempo de carga promedio

### Error Tracking
- Sentry para errores en producción
- Logs estructurados en desarrollo
- Alertas automáticas para errores críticos

## 🚀 Deployment

### Build de Producción
```bash
# Crear build optimizado
npm run build

# Preview del build
npm run preview

# Deploy (según plataforma)
npm run deploy
```

### Variables de Entorno
```env
# Requeridas
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Opcionales
VITE_APP_ENV=production
VITE_ENABLE_ANALYTICS=true
```

## 📚 Documentación Adicional

- [Arquitectura del Sistema](./ARQUITECTURA_PORTAL.md)
- [Guía de Contribución](./CONTRIBUTING.md)
- [Changelog](./CHANGELOG.md)
- [API Reference](./API_REFERENCE.md)

## 🆘 Soporte

### Problemas Comunes
1. **Error 404**: Verificar rutas en App.tsx
2. **No cargan servicios**: Revisar RLS policies
3. **Error de auth**: Verificar token de Supabase

### Contacto
- **Email**: soporte@tmsgruas.com
- **Slack**: #portal-clientes
- **Issues**: GitHub Issues

---

**Versión**: 2.0  
**Última actualización**: 2025  
**Mantenido por**: Equipo de Desarrollo TMS
