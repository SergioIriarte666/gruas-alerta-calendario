# Guía de Migración - TMS Grúas

## Introducción

Esta guía te ayudará a migrar entre versiones de TMS Grúas, con especial enfoque en la migración desde v1.0.0 a v2.0.0, que introduce el sistema responsive completo.

## Migración v1.0.0 → v2.0.0

### Resumen de Cambios Críticos

La versión 2.0.0 introduce cambios arquitectónicos significativos en el sistema responsive. Aunque la mayoría de funcionalidades permanecen compatibles, hay cambios importantes en componentes y hooks.

### ⚠️ Cambios Incompatibles (Breaking Changes)

#### 1. Sistema de Detección de Dispositivos

**❌ Antes (v1.0.0):**
```typescript
// Detección manual con useIsMobile
import { useIsMobile } from '@/hooks/useIsMobile'

const MyComponent = () => {
  const isMobile = useIsMobile()
  
  return (
    <div className={isMobile ? 'mobile-class' : 'desktop-class'}>
      {/* contenido */}
    </div>
  )
}
```

**✅ Ahora (v2.0.0):**
```typescript
// Sistema avanzado con useDeviceType
import { useDeviceType } from '@/hooks/useDeviceType'

const MyComponent = () => {
  const { isMobile, isTablet, isDesktop, deviceType } = useDeviceType()
  
  return (
    <div className={cn(
      "base-class",
      isMobile && "mobile-class",
      isTablet && "tablet-class", 
      isDesktop && "desktop-class"
    )}>
      {/* contenido */}
    </div>
  )
}
```

#### 2. Componentes con Props Responsive

**❌ Antes (v1.0.0):**
```typescript
// MetricCard básico
<MetricCard
  title="Ingresos"
  value="$1000"
  icon={DollarSign}
/>
```

**✅ Ahora (v2.0.0):**
```typescript
// MetricCard con adaptabilidad automática
<MetricCard
  title="Ingresos"
  value="$1000"
  icon={DollarSign}
  trend={{ value: 10, isPositive: true }} // Nueva prop opcional
/>
// El componente se adapta automáticamente por dispositivo
```

#### 3. Sistema de Campos de Vehículo

**❌ Antes (v1.0.0):**
```typescript
// Campos siempre visibles
<div className="vehicle-info">
  <Input name="vehicle_brand" label="Marca" />
  <Input name="vehicle_model" label="Modelo" />
  <Input name="license_plate" label="Patente" />
</div>
```

**✅ Ahora (v2.0.0):**
```typescript
// Campos condicionales según tipo de servicio
import { shouldShowVehicleInfo } from '@/utils/vehicleHelpers'

{shouldShowVehicleInfo(serviceType) && (
  <VehicleInfoSection
    required={!serviceType?.vehicle_info_optional}
    onVehicleChange={handleVehicleChange}
  />
)}
```

### 🔄 Pasos de Migración

#### Paso 1: Backup de Datos

```bash
# 1. Backup de base de datos
pg_dump DATABASE_URL > backup_v1.sql

# 2. Backup de configuración
cp .env.local .env.v1.backup

# 3. Backup de customizaciones
cp -r src/custom src_custom_backup
```

#### Paso 2: Actualizar Dependencias

```bash
# 1. Actualizar a v2.0.0
git fetch origin
git checkout v2.0.0

# 2. Instalar nuevas dependencias
npm install

# 3. Limpiar cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### Paso 3: Migrar Código Personalizado

**3.1 Actualizar Imports de Hooks**

```typescript
// Buscar y reemplazar en todos los archivos
// Antes:
import { useIsMobile } from '@/hooks/useIsMobile'

// Después:
import { useDeviceType } from '@/hooks/useDeviceType'
const { isMobile } = useDeviceType()
```

**3.2 Actualizar Media Queries Manuales**

```typescript
// ❌ Reemplazar esto:
const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

useEffect(() => {
  const handleResize = () => setIsMobile(window.innerWidth < 768)
  window.addEventListener('resize', handleResize)
  return () => window.removeEventListener('resize', handleResize)
}, [])

// ✅ Con esto:
const { isMobile } = useDeviceType()
```

**3.3 Migrar Componentes Responsive Customizados**

```typescript
// ❌ Antes:
const CustomCard = ({ title, children }) => {
  const isMobile = useIsMobile()
  
  return (
    <div className={isMobile ? 'p-2' : 'p-4'}>
      <h3>{title}</h3>
      {children}
    </div>
  )
}

// ✅ Después:
const CustomCard = ({ title, children }) => {
  const { isMobile, isTablet } = useDeviceType()
  
  return (
    <div className={cn(
      "base-styles",
      isMobile && "p-2",
      isTablet && "p-3",
      !isMobile && !isTablet && "p-4"
    )}>
      <h3>{title}</h3>
      {children}
    </div>
  )
}
```

#### Paso 4: Actualizar Formularios de Servicios

**4.1 Implementar Lógica de Vehículos Opcionales**

```typescript
// En ServiceForm.tsx
import { shouldShowVehicleInfo } from '@/utils/vehicleHelpers'

const ServiceForm = () => {
  const [serviceType, setServiceType] = useState(null)
  
  return (
    <Form>
      {/* Otros campos */}
      
      {shouldShowVehicleInfo(serviceType) && (
        <VehicleInfoSection 
          serviceType={serviceType}
          control={form.control}
        />
      )}
    </Form>
  )
}
```

**4.2 Actualizar Validaciones**

```typescript
// Esquemas de validación condicionales
const createServiceSchema = (serviceType) => z.object({
  // Campos base
  client_id: z.string().min(1, "Cliente requerido"),
  
  // Campos de vehículo condicionales
  ...(shouldShowVehicleInfo(serviceType) && {
    vehicle_brand: serviceType?.vehicle_brand_required 
      ? z.string().min(1, "Marca requerida")
      : z.string().optional(),
    vehicle_model: serviceType?.vehicle_model_required
      ? z.string().min(1, "Modelo requerido") 
      : z.string().optional(),
    license_plate: serviceType?.license_plate_required
      ? z.string().min(1, "Patente requerida")
      : z.string().optional(),
  })
})
```

#### Paso 5: Testing Post-Migración

```bash
# 1. Ejecutar suite de tests
npm run test

# 2. Tests específicos responsive
npm run test:responsive

# 3. Verificar en diferentes dispositivos
npm run dev
# Abrir DevTools y probar diferentes viewports
```

### 🧪 Checklist de Migración

#### Pre-migración
- [ ] Backup completo de datos y configuración
- [ ] Documentar customizaciones existentes
- [ ] Identificar componentes que usan responsive manual
- [ ] Planificar tiempo de inactividad (si es necesario)

#### Durante la migración
- [ ] Actualizar dependencias sin errores
- [ ] Reemplazar `useIsMobile` con `useDeviceType`
- [ ] Migrar media queries manuales
- [ ] Implementar lógica de vehículos opcionales
- [ ] Actualizar formularios de servicios
- [ ] Verificar que componentes usan nuevos hooks

#### Post-migración
- [ ] Tests pasan en todos los dispositivos
- [ ] Performance aceptable en móviles
- [ ] PWA se instala correctamente
- [ ] Funcionalidades críticas operativas
- [ ] UI/UX consistent en todos los breakpoints

### 🔧 Script de Migración Automática

```bash
#!/bin/bash
# migrate-to-v2.sh

echo "🚀 Iniciando migración TMS Grúas v1.0 → v2.0"

# 1. Backup
echo "📦 Creando backup..."
mkdir -p migration-backup/$(date +%Y%m%d)
cp -r src migration-backup/$(date +%Y%m%d)/
cp .env.local migration-backup/$(date +%Y%m%d)/

# 2. Buscar y listar archivos con useIsMobile
echo "🔍 Buscando usos de useIsMobile..."
grep -r "useIsMobile" src/ > migration-backup/useIsMobile-usages.txt

# 3. Verificar build actual
echo "🏗️ Verificando build v1.0..."
npm run build > migration-backup/build-v1-log.txt 2>&1

echo "✅ Backup completado. Revisa migration-backup/ antes de continuar."
echo "📖 Continúa con los pasos manuales según la guía."
```

### 🚨 Problemas Comunes y Soluciones

#### Error: "useDeviceType is not defined"

**Problema:** Hook no importado correctamente

**Solución:**
```typescript
// Verificar import correcto
import { useDeviceType } from '@/hooks/useDeviceType'

// NO desde ubicación antigua
// import { useDeviceType } from '@/hooks/responsive'
```

#### Error: "Cannot read property 'vehicle_info_optional' of null"

**Problema:** serviceType null en shouldShowVehicleInfo

**Solución:**
```typescript
// Verificar null safety
{serviceType && shouldShowVehicleInfo(serviceType) && (
  <VehicleInfoSection />
)}

// O usar optional chaining en la función
const shouldShowVehicleInfo = (serviceType) => {
  if (!serviceType) return false
  return serviceType.vehicle_brand_required || 
         serviceType.vehicle_model_required || 
         // ... resto de lógica
}
```

#### Performance degradada en móviles

**Problema:** Muchos re-renders por cambios de device type

**Solución:**
```typescript
// Memoizar resultados de device detection
const deviceInfo = useMemo(() => useDeviceType(), [])

// O usar memo en componentes costosos
const ExpensiveComponent = memo(({ data }) => {
  const { isMobile } = useDeviceType()
  // ... component logic
}, (prevProps, nextProps) => {
  // Custom comparison logic
  return prevProps.data.id === nextProps.data.id
})
```

### 🎯 Validación Post-Migración

#### Test de Funcionalidades Críticas

```typescript
// test-migration.spec.ts
describe('Post-Migration Validation', () => {
  it('should detect devices correctly', () => {
    const { result } = renderHook(() => useDeviceType())
    expect(result.current.deviceType).toBeDefined()
  })
  
  it('should show/hide vehicle fields correctly', () => {
    const serviceType = { vehicle_info_optional: true }
    expect(shouldShowVehicleInfo(serviceType)).toBe(false)
  })
  
  it('should render responsive components', () => {
    render(<MetricCard title="Test" value="100" icon={DollarSign} />)
    // Add device-specific assertions
  })
})
```

#### Test Manual de Dispositivos

1. **Desktop (≥1024px):**
   - [ ] Dashboard muestra 4 columnas de métricas
   - [ ] Sidebar siempre visible
   - [ ] Formularios en 3 columnas
   - [ ] Tablas completas visibles

2. **Tablet (768px-1023px):**
   - [ ] Dashboard muestra 2x2 métricas
   - [ ] Sidebar colapsible
   - [ ] Formularios en 2 columnas
   - [ ] Tablas con scroll horizontal

3. **Mobile (<768px):**
   - [ ] Dashboard métricas apiladas
   - [ ] Navegación por menú hamburguesa
   - [ ] Formularios en 1 columna
   - [ ] Tablas como tarjetas

### 📞 Soporte para Migración

Si encuentras problemas durante la migración:

1. **Revisar logs de migración** en `migration-backup/`
2. **Consultar troubleshooting** específico en docs/TROUBLESHOOTING.md
3. **Contactar soporte técnico** con logs completos
4. **Rollback a v1.0.0** si es necesario:

```bash
# Rollback de emergencia
git checkout v1.0.0
npm install
cp migration-backup/.env.local .env.local
# Restaurar customizaciones si es necesario
```

---

## Migraciones Futuras

### v2.0.0 → v2.1.0 (Planificado)

- Cambios menores en APIs de theming
- Nuevas props opcionales en componentes
- Backward compatible con v2.0.0

### v2.x.x → v3.0.0 (Futuro)

- Posibles cambios en arquitectura de datos
- Nuevas APIs para multi-empresa
- Guía de migración detallada será proporcionada

---

**Última actualización:** Enero 10, 2025  
**Versión de la guía:** 2.0.0