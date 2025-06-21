
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

## Sistema de Estados de Servicios

### Estados Principales
```typescript
type ServiceStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'invoiced';
```

### Transiciones de Estado
```mermaid
graph LR
    A[pending] --> B[in_progress]
    B --> C[completed]
    C --> D[invoiced]
    A --> E[cancelled]
    B --> E
```

### Trigger Automático de Facturación
```sql
-- Función que actualiza automáticamente el status
CREATE OR REPLACE FUNCTION public.update_service_status_on_invoice()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE services 
  SET status = 'invoiced', updated_at = now()
  WHERE id = NEW.service_id;
  
  RETURN NEW;
END;
$function$

-- Trigger que se ejecuta al insertar en invoice_services
CREATE TRIGGER trigger_update_service_status_on_invoice
  AFTER INSERT ON invoice_services
  FOR EACH ROW
  EXECUTE FUNCTION update_service_status_on_invoice();
```

## Sistema de Cierres

### Lógica de Filtrado
```typescript
// useServicesForClosures.ts
const fetchAvailableServices = async () => {
  // 1. Obtener servicios completados en rango de fechas
  let servicesQuery = supabase
    .from('services')
    .select('*')
    .eq('status', 'completed')
    .gte('service_date', dateFrom)
    .lte('service_date', dateTo);

  // 2. Obtener servicios ya en cierres
  const { data: closureServices } = await supabase
    .from('closure_services')
    .select('service_id');

  // 3. Obtener servicios ya facturados
  const { data: invoicedServices } = await supabase
    .from('invoice_services')
    .select('service_id');

  // 4. Filtrar servicios disponibles
  const usedServiceIds = new Set([
    ...closureServices.map(cs => cs.service_id),
    ...invoicedServices.map(is => is.service_id)
  ]);

  const availableServices = services.filter(service => 
    !usedServiceIds.has(service.id)
  );
};
```

### Componente ServicesSelector
```typescript
// Filtra servicios por cliente si está seleccionado
const filteredServices = services.filter(service => {
  if (!clientId) return true;
  return service.client.id === clientId;
});

// Muestra información clara sobre exclusiones
<Alert>
  <InfoIcon />
  <AlertDescription>
    • Solo servicios completados del rango de fechas
    • Se excluyen servicios ya incluidos en cierres
    • Se excluyen servicios ya facturados (status: invoiced)
  </AlertDescription>
</Alert>
```

## Sistema de Respaldos

### Arquitectura de Respaldos

El sistema de respaldos está diseñado con múltiples capas para garantizar la integridad y disponibilidad de los datos:

#### 1. Funciones de Base de Datos

```sql
-- Función para respaldo completo (SQL)
CREATE OR REPLACE FUNCTION public.generate_database_backup()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  backup_content TEXT := '';
  -- Lógica para generar respaldo SQL completo
BEGIN
  -- Verificación de permisos de administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden generar respaldos';
  END IF;
  
  -- Generación de metadatos y contenido del respaldo
  -- Procesamiento ordenado de tablas por dependencias
  -- Generación de INSERT statements
  RETURN backup_content;
END;
$$;

-- Función para respaldo rápido (JSON)
CREATE OR REPLACE FUNCTION public.generate_quick_backup()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Respaldo solo de configuración crítica
  -- Conteos de registros principales
  -- Metadatos del sistema
  RETURN backup_data;
END;
$$;
```

#### 2. Edge Function para Respaldos

```typescript
// supabase/functions/generate-backup/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Validación de permisos
  // Generación de respaldo según tipo solicitado
  // Logging de operaciones
  // Retorno de archivo para descarga
});
```

#### 3. Frontend - Hook de Gestión

```typescript
// useBackupManager.ts
export const useBackupManager = () => {
  const [progress, setProgress] = useState<BackupProgress>({
    isGenerating: false,
    progress: 0,
    stage: 'idle'
  });

  const generateBackup = useCallback(async (type: 'full' | 'quick') => {
    // Manejo de progreso en tiempo real
    // Invocación de edge function
    // Manejo de errores y estado
    // Retorno de resultado para descarga
  }, []);

  const downloadBackup = useCallback((content, fileName, contentType) => {
    // Creación de blob y descarga automática
    // Notificaciones de usuario
  }, []);
};
```

### Tipos de Respaldo

#### Respaldo Completo (`full`)
- **Contenido**: Todas las tablas del sistema con datos completos
- **Formato**: Archivo SQL con INSERT statements
- **Uso**: Restauración completa del sistema
- **Tamaño**: Mayor (depende de cantidad de datos)
- **Tiempo**: 30 segundos - 5 minutos (según volumen)

#### Respaldo Rápido (`quick`)
- **Contenido**: Solo configuración y estadísticas
- **Formato**: JSON estructurado
- **Uso**: Migración de configuración, verificación rápida
- **Tamaño**: Menor (< 1MB típicamente)
- **Tiempo**: 5-15 segundos

### Seguridad y Permisos

#### Validación de Acceso
```sql
-- Solo administradores pueden generar respaldos
IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
  RAISE EXCEPTION 'Solo los administradores pueden generar respaldos';
END IF;
```

#### Logging de Auditoría
```sql
-- Tabla para registro de respaldos
CREATE TABLE backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  backup_type TEXT CHECK (backup_type IN ('full', 'quick', 'auto')),
  status TEXT CHECK (status IN ('started', 'completed', 'failed')),
  file_size_bytes BIGINT,
  error_message TEXT,
  metadata JSONB
);
```

#### RLS Policies
```sql
-- Solo administradores ven logs
CREATE POLICY "Only admins can view backup logs" ON backup_logs
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
```

### Proceso de Respaldo

#### 1. Iniciación
```typescript
// Usuario solicita respaldo desde interfaz
const result = await generateAndDownloadBackup('full');
```

#### 2. Validación
```typescript
// Edge function valida permisos y crea log
const { data: logData } = await supabaseClient
  .from('backup_logs')
  .insert({ backup_type: type, status: 'started' });
```

#### 3. Generación
```typescript
// Invocación de función SQL según tipo
const { data: backupData, error } = await supabaseClient
  .rpc(type === 'quick' ? 'generate_quick_backup' : 'generate_database_backup');
```

#### 4. Finalización
```typescript
// Actualización de log y descarga
await supabaseClient
  .from('backup_logs')
  .update({ 
    status: 'completed',
    file_size_bytes: new Blob([content]).size,
    metadata: { fileName, contentType }
  });
```

### Monitoreo y Alertas

#### Dashboard de Estado
```typescript
// BackupManagementSection.tsx
const lastSuccessfulBackup = backupLogs?.find(log => log.status === 'completed');

// Indicadores visuales de estado
{lastSuccessfulBackup ? (
  <Alert className="bg-green-500/10">
    <CheckCircle />
    <AlertDescription>
      Último respaldo: {formatDistanceToNow(new Date(lastSuccessfulBackup.created_at))}
    </AlertDescription>
  </Alert>
) : (
  <Alert className="bg-yellow-500/10">
    <AlertTriangle />
    <AlertDescription>
      No se encontraron respaldos. Se recomienda generar uno.
    </AlertDescription>
  </Alert>
)}
```

#### Historial de Respaldos
```typescript
// Tabla de historial con filtros
const { data: backupLogs } = useQuery({
  queryKey: ['backup-logs'],
  queryFn: async () => {
    const { data } = await supabase
      .from('backup_logs')
      .select(`*, profiles!backup_logs_created_by_fkey(email, full_name)`)
      .order('created_at', { ascending: false })
      .limit(10);
    return data;
  }
});
```

### Restauración

#### Preparación
1. **Entorno**: Sistema limpio o con respaldo actual
2. **Herramientas**: Cliente PostgreSQL (psql, pgAdmin, etc.)
3. **Permisos**: Acceso de administrador a base de datos
4. **Validación**: Verificar compatibilidad de versiones

#### Proceso de Restauración (Respaldo Completo)
```bash
# 1. Conectar a base de datos
psql -h hostname -U username -d database_name

# 2. Limpiar datos existentes (CUIDADO!)
TRUNCATE TABLE services, invoices, clients CASCADE;

# 3. Desactivar RLS temporalmente
SET row_security = off;

# 4. Ejecutar archivo de respaldo
\i /path/to/backup-file.sql

# 5. Reactivar RLS
SET row_security = on;

# 6. Verificar integridad
SELECT count(*) FROM services;
SELECT count(*) FROM clients;
```

#### Verificación Post-Restauración
```sql
-- Verificar conteos de registros
SELECT 
  'services' as table_name, count(*) as records FROM services
UNION ALL
SELECT 
  'clients' as table_name, count(*) as records FROM clients
UNION ALL
SELECT 
  'invoices' as table_name, count(*) as records FROM invoices;

-- Verificar integridad referencial
SELECT 
  s.folio, 
  c.name as client_name,
  o.name as operator_name
FROM services s
LEFT JOIN clients c ON s.client_id = c.id
LEFT JOIN operators o ON s.operator_id = o.id
WHERE c.id IS NULL OR o.id IS NULL
LIMIT 10;
```

## Servicios con Campos Opcionales

### Configuración en Base de Datos
```sql
-- Campo en service_types
ALTER TABLE service_types 
ADD COLUMN vehicle_info_optional boolean NOT NULL DEFAULT false;

-- Servicios especiales
UPDATE service_types 
SET vehicle_info_optional = true 
WHERE name ILIKE '%taxi%' OR name ILIKE '%transporte de materiales%';
```

### Validación Condicional
```typescript
// VehicleSection.tsx
interface VehicleSectionProps {
  serviceType?: ServiceType;
  // otros props...
}

const VehicleSection = ({ serviceType, ...props }) => {
  const isOptional = serviceType?.vehicle_info_optional || false;

  return (
    <div>
      <Label>
        Marca del Vehículo 
        {!isOptional && <span className="text-red-500">*</span>}
      </Label>
      {isOptional && (
        <p className="text-xs text-gray-400">
          Opcional para este tipo de servicio
        </p>
      )}
      <Input required={!isOptional} {...props} />
    </div>
  );
};
```

### Esquema de Validación
```typescript
// En serviceSchema.ts
const createServiceSchema = (isVehicleOptional: boolean) => z.object({
  folio: z.string().min(1),
  client_id: z.string().uuid(),
  service_type_id: z.string().uuid(),
  vehicle_brand: isVehicleOptional 
    ? z.string().optional() 
    : z.string().min(1, "Marca requerida"),
  vehicle_model: isVehicleOptional 
    ? z.string().optional() 
    : z.string().min(1, "Modelo requerido"),
  license_plate: isVehicleOptional 
    ? z.string().optional() 
    : z.string().min(1, "Patente requerida"),
});
```

## Gestión de Usuarios

### Funciones de Base de Datos

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
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, p.email, p.full_name, p.role, p.is_active, p.created_at, p.updated_at
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

##### update_user_role()
```sql
CREATE OR REPLACE FUNCTION public.update_user_role(
  user_id uuid,
  new_role app_role
) RETURNS void AS $$
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden cambiar roles';
  END IF;

  UPDATE public.profiles 
  SET role = new_role, updated_at = now()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Hook useUserManagement
```typescript
const useUserManagement = () => {
  const fetchUsers = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_users');
      if (error) throw error;
      return data;
    },
  });

  const updateUserRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { error } = await supabase.rpc('update_user_role', { 
        user_id: userId, 
        new_role: newRole 
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries(['users']),
  });

  return { fetchUsers, updateUserRole };
};
```

## Progressive Web App (PWA)

### Configuración del Manifest
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

### Service Worker
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

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

## Row Level Security (RLS)

### Políticas para Operadores
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

### Funciones de Soporte
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

## Inspección de Servicios

### Esquema de Datos
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
  photos_before_service: string[];
  photos_client_vehicle: string[];
  photos_equipment_used: string[];
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

### Componente de Inspección
```typescript
// ServiceInspection.tsx
const ServiceInspection = () => {
  const { id } = useParams();
  const { data: service } = useOperatorService(id);
  
  const handleSubmitInspection = async (data: InspectionData) => {
    const { error } = await supabase.from('inspections').insert({
      service_id: id,
      operator_id: service.operator.id,
      equipment_checklist: data.checklist,
      vehicle_observations: data.observations,
      operator_signature: data.signature,
      photos_before_service: data.photos,
    });
    
    if (error) throw error;
    
    // Actualizar estado del servicio
    await supabase
      .from('services')
      .update({ status: 'completed' })
      .eq('id', id);
  };
};
```

## Debugging y Troubleshooting

### Console Logs para Debugging
```typescript
// En useBackupManager.ts
console.log('Starting backup generation:', type);
console.log('Backup result:', { success, fileName, size });

// En useServicesForClosures.ts
console.log('Fetching services with filters:', { dateFrom, dateTo });
console.log('Completed services found:', servicesData?.length);
console.log('Services already in closures:', usedServiceIds.size);
console.log('Available services for closures:', availableServicesData.length);

// En BackupManagementSection.tsx
console.log('Backup progress update:', progress);
console.log('Backup logs loaded:', backupLogs?.length);
```

### Problemas Comunes y Soluciones

#### 1. Operador no ve servicios
**Diagnóstico:**
```sql
-- Verificar vinculación usuario-operador
SELECT o.*, p.email, p.role 
FROM operators o 
JOIN profiles p ON o.user_id = p.id 
WHERE p.email = 'operador@empresa.com';

-- Verificar servicios asignados
SELECT s.folio, s.status, o.name as operator_name
FROM services s
JOIN operators o ON s.operator_id = o.id
WHERE o.user_id = 'user-uuid';
```

**Solución:**
```sql
-- Vincular usuario con operador
UPDATE operators 
SET user_id = (SELECT id FROM profiles WHERE email = 'operador@empresa.com')
WHERE name = 'Juan Pérez';
```

#### 2. Servicios no aparecen en cierres
**Diagnóstico:**
```typescript
// Verificar estado de servicios
console.log('Service status check:', {
  folio: service.folio,
  status: service.status,
  isCompleted: service.status === 'completed',
  isInvoiced: service.status === 'invoiced'
});
```

**Solución:**
```sql
-- Corregir servicios mal marcados
UPDATE services 
SET status = 'completed' 
WHERE status = 'invoiced' 
AND id NOT IN (SELECT service_id FROM invoice_services);
```

#### 3. Campos de vehículo requeridos incorrectamente
**Diagnóstico:**
```typescript
// Verificar configuración de tipo de servicio
console.log('Service type config:', {
  name: serviceType.name,
  vehicleOptional: serviceType.vehicle_info_optional
});
```

**Solución:**
```sql
-- Configurar tipo como opcional
UPDATE service_types 
SET vehicle_info_optional = true 
WHERE name ILIKE '%taxi%';
```

#### 4. Errores en generación de respaldos
**Diagnóstico:**
```typescript
// Verificar logs de respaldo
const { data: errorLogs } = await supabase
  .from('backup_logs')
  .select('*')
  .eq('status', 'failed')
  .order('created_at', { ascending: false })
  .limit(5);

console.log('Recent backup errors:', errorLogs);
```

**Solución:**
```sql
-- Verificar permisos de usuario
SELECT p.role, p.email 
FROM profiles p 
WHERE p.id = auth.uid();

-- Limpiar logs antiguos si es necesario
DELETE FROM backup_logs 
WHERE created_at < now() - interval '30 days';
```

#### 5. Problemas de descarga de respaldos
**Diagnóstico:**
```typescript
// Verificar configuración del navegador
console.log('Browser download support:', {
  blobSupport: typeof Blob !== 'undefined',
  urlSupport: typeof URL !== 'undefined',
  downloadSupport: typeof document.createElement('a').download !== 'undefined'
});
```

**Solución:**
```typescript
// Fallback para descarga
const downloadWithFallback = (content: string, fileName: string) => {
  try {
    // Método principal
    const blob = new Blob([content], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    // Fallback: abrir en nueva ventana
    const newWindow = window.open();
    newWindow?.document.write(`<pre>${content}</pre>`);
    newWindow?.document.title = fileName;
  }
};
```

## API References

### Endpoints Principales
```typescript
// Obtener servicios del operador
GET /rest/v1/services?operator_id=eq.{operatorId}&status=in.(pending,in_progress)

// Servicios disponibles para cierres
GET /rest/v1/services?status=eq.completed&service_date=gte.{dateFrom}&service_date=lte.{dateTo}

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

// Generar respaldo (Edge Function)
POST /functions/v1/generate-backup
{
  "type": "full" | "quick"
}

// Obtener logs de respaldos
GET /rest/v1/backup_logs?order=created_at.desc&limit=10
```

### Edge Functions

#### generate-backup
```typescript
// Endpoint: /functions/v1/generate-backup
// Método: POST
// Headers: Authorization (required)
// Body: { type: 'full' | 'quick' }
// Response: { success: boolean, fileName?: string, content?: string, error?: string }

// Ejemplo de uso
const { data, error } = await supabase.functions.invoke('generate-backup', {
  body: { type: 'full' }
});
```

### Performance Optimizations

#### Query Optimization
```typescript
// Usar select específicos para reducir datos transferidos
const { data } = await supabase
  .from('services')
  .select(`
    id, folio, status, service_date, value,
    clients(id, name),
    service_types(id, name, vehicle_info_optional)
  `)
  .eq('operator_id', operatorId);

// Paginación para historial de respaldos
const { data: backupLogs } = await supabase
  .from('backup_logs')
  .select('*')
  .order('created_at', { ascending: false })
  .range(0, 9); // Solo últimos 10 registros
```

#### Cache Strategy
```typescript
// TanStack Query con cache inteligente
const { data } = useQuery({
  queryKey: ['operatorServices', operatorId],
  queryFn: fetchOperatorServices,
  staleTime: 5 * 60 * 1000, // 5 minutos
  refetchOnWindowFocus: false,
  refetchInterval: 30 * 1000, // 30 segundos para operadores
});

// Cache específico para respaldos
const { data: backupLogs } = useQuery({
  queryKey: ['backup-logs'],
  queryFn: fetchBackupLogs,
  staleTime: 30 * 1000, // 30 segundos
  refetchOnMount: true, // Siempre refrescar al montar
});
```

#### Background Processing
```typescript
// Edge Function con background tasks
EdgeRuntime.waitUntil(
  backgroundCleanupTask() // Limpieza de logs antiguos
);

// Procesamiento asíncrono de respaldos grandes
const processLargeBackup = async (data: any[]) => {
  const chunks = chunkArray(data, 100);
  for (const chunk of chunks) {
    await processChunk(chunk);
    // Yield control to allow other operations
    await new Promise(resolve => setTimeout(resolve, 0));
  }
};
```

### Security Considerations

#### Input Validation
```typescript
// Validación con Zod para respaldos
const backupRequestSchema = z.object({
  type: z.enum(['full', 'quick']),
  options: z.object({
    includeMetadata: z.boolean().optional(),
    compression: z.boolean().optional()
  }).optional()
});
```

#### Rate Limiting
```typescript
// Límite de respaldos por usuario
const BACKUP_RATE_LIMIT = 5; // por hora
const userBackupCount = await supabase
  .from('backup_logs')
  .select('id')
  .eq('created_by', userId)
  .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
  .single();

if (userBackupCount?.length >= BACKUP_RATE_LIMIT) {
  throw new Error('Rate limit exceeded');
}
```

#### Sanitización
```typescript
// Sanitizar datos antes de enviar
const sanitizeInput = (input: string) => {
  return input.trim().replace(/[<>]/g, '');
};

// Validar tamaño de respaldo
const MAX_BACKUP_SIZE = 50 * 1024 * 1024; // 50MB
if (backupContent.length > MAX_BACKUP_SIZE) {
  throw new Error('Backup size exceeds limit');
}
```

## Configuración de Entorno

### Variables de Entorno Requeridas
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Edge Functions
SUPABASE_FUNCTION_SECRET=your-function-secret

# Database
DATABASE_URL=postgresql://user:pass@host:port/dbname

# Backup Configuration
MAX_BACKUP_SIZE_MB=100
BACKUP_RETENTION_DAYS=30
BACKUP_RATE_LIMIT_PER_HOUR=5
```

### Configuración de Supabase
```toml
# supabase/config.toml
project_id = "your-project-id"

[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[auth]
enabled = true
port = 54324
site_url = "http://localhost:3000"
additional_redirect_urls = ["https://your-domain.com"]

[functions]
verify_jwt = true

[functions.generate-backup]
verify_jwt = true
```

### Migración y Deployment

#### Scripts de Migración
```sql
-- Migración para respaldos (versión 1.0)
-- Agregar tablas y funciones de respaldo
CREATE TABLE IF NOT EXISTS backup_logs (...);
CREATE OR REPLACE FUNCTION generate_database_backup() ...;
CREATE OR REPLACE FUNCTION generate_quick_backup() ...;

-- Migración para configuración extendida (versión 1.1)
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS backup_retention_days INTEGER DEFAULT 30;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS max_backup_size_mb INTEGER DEFAULT 100;
```

#### Deployment Checklist
- [ ] Migrar funciones SQL de respaldo
- [ ] Desplegar Edge Function generate-backup
- [ ] Actualizar configuración de RLS
- [ ] Verificar permisos de administrador
- [ ] Probar generación de respaldos en ambiente de prueba
- [ ] Configurar monitoreo y alertas
- [ ] Documentar procedimientos de emergencia
- [ ] Capacitar administradores en nuevas funcionalidades

Esta documentación técnica proporciona toda la información necesaria para entender, mantener y extender el sistema TMS Grúas, con especial enfoque en el correcto funcionamiento del sistema de estados de servicios, cierres, facturación y el nuevo sistema de respaldos y recuperación.
