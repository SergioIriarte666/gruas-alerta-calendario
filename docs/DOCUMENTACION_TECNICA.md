
# Documentación Técnica - TMS Grúas

## Portal del Operador

### Configuración Inicial

Para que un operador pueda acceder al sistema, se requiere:

1. **Crear perfil de usuario con rol de operador:**
```sql
INSERT INTO profiles (id, email, full_name, role) 
VALUES (uuid_generate_v4(), 'operador@empresa.com', 'Juan Pérez', 'operator');
```

2. **Vincular usuario con registro de operador:**
```sql
UPDATE operators 
SET user_id = (SELECT id FROM profiles WHERE email = 'operador@empresa.com')
WHERE name = 'Juan Pérez';
```

3. **Asignar servicios al operador:**
```sql
UPDATE services 
SET operator_id = (SELECT id FROM operators WHERE name = 'Juan Pérez')
WHERE id = 'service-uuid';
```

### Flujo de Autenticación

#### 1. Login y Validación
```typescript
// AuthContext maneja la autenticación
const { user: authUser, session } = useAuth();

// UserContext obtiene el perfil completo
const { user: profileUser } = useUser();
```

#### 2. Redirección Automática
```typescript
// ProtectedRoute.tsx
if (userRole === 'operator' && !isOperatorPortalRoute) {
  return <Navigate to="/operator" replace />;
}
```

#### 3. Carga de Servicios
```typescript
// useOperatorServices.ts
const fetchOperatorServices = async (userId: string) => {
  // 1. Obtener operator_id del usuario
  const { data: operatorData } = await supabase
    .from('operators')
    .select('id')
    .eq('user_id', userId)
    .single();

  // 2. Obtener servicios asignados
  const { data: services } = await supabase
    .from('services')
    .select('*, clients(*), cranes(*), service_types(*)')
    .eq('operator_id', operatorData.id)
    .in('status', ['pending', 'in_progress']);
};
```

### Componentes Principales

#### OperatorDashboard
- **Propósito**: Vista principal del operador
- **Datos**: Servicios asignados, información del usuario
- **Estados**: Loading, error, sin servicios, servicios disponibles

#### AssignedServiceCard
- **Propósito**: Tarjeta de servicio individual
- **Navegación**: Link a inspección del servicio
- **Información**: Folio, cliente, fecha, tipo de servicio, ubicaciones

#### OperatorLayout
- **Propósito**: Layout simplificado para operadores
- **Características**: Sin sidebar completo, navegación mínima

### Gestión de Usuarios

#### Funciones de Base de Datos

##### get_all_users()
```sql
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role app_role,
  is_active boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);
```

##### update_user_role()
```sql
CREATE OR REPLACE FUNCTION public.update_user_role(
  user_id uuid,
  new_role app_role
) RETURNS void;
```

##### toggle_user_status()
```sql
CREATE OR REPLACE FUNCTION public.toggle_user_status(
  user_id uuid,
  new_status boolean
) RETURNS void;
```

#### Hook useUserManagement
```typescript
const useUserManagement = () => {
  const fetchUsers = async () => {
    const { data, error } = await supabase.rpc('get_all_users');
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    await supabase.rpc('update_user_role', { user_id: userId, new_role: newRole });
  };

  const toggleUserStatus = async (userId: string, newStatus: boolean) => {
    await supabase.rpc('toggle_user_status', { user_id: userId, new_status: newStatus });
  };
};
```

### Progressive Web App (PWA)

#### Configuración del Manifest
```json
{
  "name": "TMS Grúas - Sistema de Gestión",
  "short_name": "TMS Grúas",
  "description": "Sistema integral de gestión para empresas de grúas",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#10b981",
  "background_color": "#0f172a",
  "icons": [
    {
      "src": "/favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    }
  ]
}
```

#### Service Worker
```javascript
// sw.js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('tms-gruas-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/static/js/bundle.js',
        '/static/css/main.css'
      ]);
    })
  );
});
```

### Row Level Security (RLS)

#### Políticas para Operadores
```sql
-- Servicios: Solo ver servicios asignados
CREATE POLICY "Users can view services based on role" ON services
  FOR SELECT
  USING (
    (get_user_role(auth.uid()) IN ('admin', 'viewer'))
    OR
    (get_user_role(auth.uid()) = 'operator' AND operator_id = get_operator_id_by_user(auth.uid()))
  );

-- Operadores: Solo ver su propio registro
CREATE POLICY "Users can view operators based on role" ON operators
  FOR SELECT
  USING (
    (get_user_role(auth.uid()) IN ('admin', 'viewer'))
    OR
    (get_user_role(auth.uid()) = 'operator' AND user_id = auth.uid())
  );
```

#### Funciones de Soporte
```sql
-- Obtener rol del usuario
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid DEFAULT auth.uid())
RETURNS app_role AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Obtener ID del operador por usuario
CREATE OR REPLACE FUNCTION public.get_operator_id_by_user(p_user_id uuid)
RETURNS uuid AS $$
BEGIN
  RETURN (SELECT id FROM public.operators WHERE user_id = p_user_id LIMIT 1);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

### Inspección de Servicios

#### Esquema de Datos
```typescript
interface Inspection {
  id: string;
  service_id: string;
  operator_id: string;
  equipment_checklist: ChecklistItem[];
  vehicle_observations: string;
  operator_signature: string;
  client_name?: string;
  client_rut?: string;
  created_at: string;
}

interface ChecklistItem {
  id: string;
  name: string;
  category: string;
  checked: boolean;
  observations?: string;
}
```

#### Componente de Inspección
```typescript
// ServiceInspection.tsx
const ServiceInspection = () => {
  const { id } = useParams();
  const { data: service } = useOperatorService(id);
  
  const handleSubmitInspection = async (data: InspectionData) => {
    await supabase.from('inspections').insert({
      service_id: id,
      operator_id: service.operator.id,
      equipment_checklist: data.checklist,
      vehicle_observations: data.observations,
      operator_signature: data.signature
    });
  };
};
```

### Troubleshooting

#### Problemas Comunes

1. **Operador no ve servicios:**
   - Verificar que `user_id` esté configurado en tabla `operators`
   - Confirmar que servicios estén asignados al `operator_id` correcto
   - Revisar políticas RLS

2. **Error de autenticación:**
   - Verificar que el usuario tenga rol `operator`
   - Confirmar que el perfil existe en tabla `profiles`

3. **Redirección incorrecta:**
   - Revisar lógica en `ProtectedRoute.tsx`
   - Verificar rutas en `App.tsx`

#### Debugging
```typescript
// Agregar logs para debugging
console.log('User role:', user?.role);
console.log('Operator services:', services);
console.log('Current route:', location.pathname);
```

### API References

#### Endpoints Principales
```typescript
// Obtener servicios del operador
GET /rest/v1/services?operator_id=eq.{operatorId}&status=in.(pending,in_progress)

// Crear inspección
POST /rest/v1/inspections
{
  "service_id": "uuid",
  "operator_id": "uuid",
  "equipment_checklist": [...],
  "operator_signature": "base64string"
}

// Actualizar estado de servicio
PATCH /rest/v1/services?id=eq.{serviceId}
{
  "status": "completed"
}
```

### Performance Optimizations

#### Query Optimization
```typescript
// Usar select específicos para reducir datos transferidos
const { data } = await supabase
  .from('services')
  .select('id, folio, status, service_date, clients(name), service_types(name)')
  .eq('operator_id', operatorId);
```

#### Cache Strategy
```typescript
// TanStack Query con cache inteligente
const { data } = useQuery({
  queryKey: ['operatorServices', operatorId],
  queryFn: fetchOperatorServices,
  staleTime: 5 * 60 * 1000, // 5 minutos
  refetchOnWindowFocus: false
});
```

### Security Considerations

#### Input Validation
```typescript
// Validación con Zod
const inspectionSchema = z.object({
  equipment_checklist: z.array(checklistItemSchema),
  vehicle_observations: z.string().max(1000),
  operator_signature: z.string().min(1)
});
```

#### Sanitización
```typescript
// Sanitizar datos antes de enviar
const sanitizeInput = (input: string) => {
  return input.trim().replace(/[<>]/g, '');
};
```

Esta documentación técnica proporciona toda la información necesaria para entender, mantener y extender el sistema TMS Grúas, con especial enfoque en el portal del operador y las funcionalidades PWA.
