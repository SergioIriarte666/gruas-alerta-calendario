# Guía de Configuración Multiempresa

## Resumen

Este documento describe las opciones disponibles para configurar TMS Grúas como una aplicación multiempresa, permitiendo que múltiples empresas utilicen el sistema de forma independiente y aislada.

## Estado Actual

**TMS Grúas actualmente está configurado como una aplicación monoempresa:**
- Una sola base de datos para toda la aplicación
- Configuración única en `company_data`
- Usuarios y datos compartidos en el mismo tenant

## Opciones de Implementación Multiempresa

### 1. 🏆 **Tenant por Subdominio (RECOMENDADO)**

**Estructura:**
- `empresa1.tmsgruas.com`
- `empresa2.tmsgruas.com` 
- `empresa3.tmsgruas.com`

**Características:**
- Cada empresa tiene su propia instancia de Supabase
- Datos completamente aislados
- Configuración independiente por empresa
- URL personalizada para cada cliente

**Beneficios:**
- ✅ Aislamiento total de datos
- ✅ Personalizaciones específicas por empresa
- ✅ Escalabilidad horizontal
- ✅ Seguridad máxima
- ✅ Mejor experiencia de usuario

### 2. **Tenant por company_id**

**Estructura:**
- Agregar `company_id` a todas las tablas
- Filtros RLS por empresa
- Configuración múltiple en `company_data`

**Beneficios:**
- ✅ Implementación más simple
- ✅ Una sola base de datos
- ⚠️ Menos aislamiento de datos
- ⚠️ Riesgo de cross-contamination

### 3. **Multi-instancia**

**Estructura:**
- Despliegues separados por empresa
- Dominios independientes
- Configuración manual

**Beneficios:**
- ✅ Aislamiento total
- ❌ Alto costo operativo
- ❌ Mantenimiento complejo

## Plan de Implementación Recomendado

### Fase 1: Infraestructura Base

#### 1.1 Configuración de Tenants
```sql
-- Crear tabla de registro de empresas
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  supabase_url TEXT NOT NULL,
  supabase_anon_key TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### 1.2 Configuración DNS
```
# Configuración DNS necesaria
*.tmsgruas.com → Lovable/Vercel
```

#### 1.3 Variables de Entorno Dinámicas
```typescript
// Detección automática de tenant
const getTenantConfig = (subdomain: string) => {
  // Lookup en tabla tenants o config estático
  return {
    supabaseUrl: process.env[`SUPABASE_URL_${subdomain.toUpperCase()}`],
    supabaseAnonKey: process.env[`SUPABASE_ANON_KEY_${subdomain.toUpperCase()}`]
  }
}
```

### Fase 2: Frontend Adaptativo

#### 2.1 Detección de Tenant
```typescript
// hooks/useTenant.ts
export const useTenant = () => {
  const [tenant, setTenant] = useState(null);
  
  useEffect(() => {
    const subdomain = window.location.hostname.split('.')[0];
    if (subdomain !== 'www' && subdomain !== 'localhost') {
      // Cargar configuración del tenant
      loadTenantConfig(subdomain);
    }
  }, []);
  
  return tenant;
}
```

#### 2.2 Cliente Supabase Dinámico
```typescript
// lib/supabase-multi-tenant.ts
export const createTenantClient = (tenantConfig) => {
  return createClient(
    tenantConfig.supabaseUrl,
    tenantConfig.supabaseAnonKey
  );
};
```

#### 2.3 Branding Personalizado
```typescript
// Personalización por empresa
const TenantTheme = ({ children, tenant }) => {
  const theme = {
    logo: tenant.logo_url,
    primaryColor: tenant.primary_color,
    companyName: tenant.company_name
  };
  
  return (
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  );
};
```

### Fase 3: Autenticación Multiempresa

#### 3.1 Login con Validación de Tenant
```typescript
const handleLogin = async (email, password, subdomain) => {
  const tenantClient = await getTenantClient(subdomain);
  const { data, error } = await tenantClient.auth.signInWithPassword({
    email,
    password
  });
  
  // Validar que el usuario pertenece al tenant
  if (data.user && !await validateUserTenant(data.user.id, subdomain)) {
    throw new Error('Usuario no autorizado para este tenant');
  }
  
  return { data, error };
};
```

#### 3.2 Invitaciones por Empresa
```typescript
const inviteUser = async (email, role, tenantId) => {
  // Crear usuario en el tenant específico
  // Enviar invitación con link al subdominio correcto
  const inviteLink = `https://${tenant.subdomain}.tmsgruas.com/invite?token=${token}`;
};
```

### Fase 4: Panel de Administración

#### 4.1 Super Admin Dashboard
```typescript
// Gestión de tenants desde panel central
const SuperAdminDashboard = () => {
  return (
    <div>
      <TenantsList />
      <CreateTenantForm />
      <TenantMetrics />
      <BillingManagement />
    </div>
  );
};
```

#### 4.2 Provisioning Automático
```typescript
const createNewTenant = async (companyData) => {
  // 1. Crear nuevo proyecto Supabase
  // 2. Ejecutar migraciones base
  // 3. Configurar RLS policies
  // 4. Crear usuario admin inicial
  // 5. Registrar en tabla tenants
  // 6. Configurar DNS automático
};
```

## Consideraciones Técnicas

### Seguridad
- Cada tenant tiene sus propias credenciales Supabase
- RLS policies aplicadas por tenant
- Certificados SSL por subdominio
- Backup aislado por empresa

### Performance
- CDN por geolocalización
- Cache específico por tenant
- Optimización de queries por empresa
- Métricas separadas

### Escalabilidad
- Auto-scaling por tenant
- Load balancing inteligente
- Particionamiento horizontal
- Monitoring granular

### Costos
- Facturación por tenant activo
- Pricing escalonado según uso
- Recursos dedicados vs compartidos
- Backup y storage por empresa

## Migración desde Monoempresa

### Plan de Migración
1. **Backup completo** de datos actuales
2. **Crear tenant principal** para empresa actual
3. **Migrar datos** a nueva estructura
4. **Validar funcionalidad** completa
5. **Actualizar DNS** para nuevo esquema
6. **Monitorear** durante 48h

### Timeline Estimado
- **Semana 1-2**: Infraestructura base
- **Semana 3-4**: Frontend adaptativo  
- **Semana 5-6**: Autenticación multiempresa
- **Semana 7-8**: Panel administración
- **Semana 9**: Testing y migración
- **Semana 10**: Deploy y monitoreo

## Alternativas Simples

### Opción Básica: Filtros por Company
Si se requiere una solución más simple a corto plazo:

1. Agregar `company_id` a tablas principales
2. Modificar RLS policies para filtrar por empresa
3. Permitir registro de múltiples empresas
4. Panel de selección de empresa en login

**Pros:** Implementación rápida (1-2 semanas)
**Contras:** Menor aislamiento, riesgos de seguridad

## Conclusión

La **configuración por subdominio** es la opción más robusta y escalable para hacer TMS Grúas multiempresa. Aunque requiere más inversión inicial, proporciona:

- Aislamiento total de datos
- Experiencia personalizada por cliente
- Escalabilidad empresarial
- Seguridad nivel enterprise
- Flexibilidad para customizaciones

La implementación completa toma aproximadamente **10 semanas** pero puede dividirse en fases para entregar valor incremental.