# Guía de Componentes - TMS Grúas

## Introducción

Esta guía documenta todos los componentes del sistema TMS Grúas, incluyendo componentes UI base, componentes de negocio, hooks personalizados y utilidades. Cada componente está diseñado con principios responsive y mobile-first.

## Componentes Base (UI)

### Button

Componente de botón adaptativo con variantes responsive.

```typescript
import { Button } from "@/components/ui/button"

// Uso básico
<Button variant="default" size="default">
  Botón estándar
</Button>

// Variantes responsive
<Button 
  variant="default" 
  size={isMobile ? "lg" : "default"}
  className="touch-friendly"
>
  Botón táctil
</Button>
```

**Props:**
- `variant`: default | destructive | outline | secondary | ghost | link
- `size`: default | sm | lg | icon
- `className`: Clases adicionales de Tailwind

**Características Responsive:**
- Tamaño mínimo táctil en móviles (44px)
- Padding ajustado según dispositivo
- Estados hover/active optimizados para touch

### Input

Campo de entrada optimizado para diferentes dispositivos.

```typescript
import { Input } from "@/components/ui/input"

// Uso estándar
<Input 
  type="text" 
  placeholder="Ingrese texto"
  className="w-full"
/>

// Input táctil optimizado
<Input 
  type="email"
  inputMode="email"
  className={cn(
    "w-full",
    isMobile && "text-base" // Previene zoom en iOS
  )}
/>
```

**Características Móviles:**
- `inputMode` apropiado para teclados móviles
- Tamaño de texto 16px+ para prevenir zoom iOS
- Padding táctil mejorado

### Dialog / Modal

Sistema de modales adaptativos por dispositivo.

```typescript
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog"

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className={cn(
    // Base styles
    "max-w-md",
    // Responsive adjustments
    isMobile && "mx-4 max-w-[calc(100vw-2rem)]",
    isTablet && "max-w-2xl",
    isDesktop && "max-w-4xl"
  )}>
    <DialogHeader>
      <DialogTitle>Título del Modal</DialogTitle>
    </DialogHeader>
    {/* Contenido */}
  </DialogContent>
</Dialog>
```

**Adaptaciones por Dispositivo:**
- **Mobile**: Full width con margen mínimo
- **Tablet**: Ancho intermedio balanceado  
- **Desktop**: Ancho completo con máximo controlado

## Componentes de Layout

### MetricCard

Componente principal para mostrar métricas del dashboard.

```typescript
import { MetricCard } from "@/components/dashboard/MetricCard"

<MetricCard
  title="Ingresos del Mes"
  value="$2,450,000"
  icon={DollarSign}
  trend={{ value: 12, isPositive: true }}
  description="Comparado con el mes anterior"
/>
```

**Props:**
- `title`: string - Título de la métrica
- `value`: string | number - Valor principal
- `icon`: LucideIcon - Ícono de Lucide React
- `trend?`: { value: number, isPositive: boolean } - Tendencia opcional
- `description?`: string - Descripción adicional

**Comportamiento Responsive:**
- **Mobile**: Stack vertical, icono prominente, texto grande
- **Tablet**: Grid 2 columnas, información balanceada
- **Desktop**: Grid 4 columnas, información completa

### Header

Componente de encabezado adaptativo para páginas.

```typescript
import { Header } from "@/components/layout/Header"

<Header
  title="Gestión de Servicios"
  subtitle="Administra todos los servicios de grúa"
  actions={
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      Nuevo Servicio
    </Button>
  }
/>
```

**Características:**
- Título responsive con typography adaptativa
- Acciones que se colapsan en móviles
- Breadcrumbs opcionales para navegación

### Sidebar

Navegación lateral adaptativa.

```typescript
// Comportamiento automático por dispositivo:
// Mobile: Colapsible overlay
// Tablet: Semi-persistente 
// Desktop: Fija y expandida
```

**Estados por Dispositivo:**
- **Mobile**: Overlay con backdrop, control por hamburger menu
- **Tablet**: Colapsible lateral, iconos + texto corto
- **Desktop**: Sidebar fija completa con navegación expandida

## Componentes de Formularios

### ServiceForm

Formulario principal para creación/edición de servicios.

```typescript
import { ServiceForm } from "@/components/services/ServiceForm"

<ServiceForm
  mode="create" // o "edit"
  initialData={serviceData}
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>
```

**Características Responsive:**
- **Mobile**: Layout en una columna, campos apilados
- **Tablet**: Grid 2 columnas para campos relacionados
- **Desktop**: Grid 3 columnas con agrupación lógica

**Campos Adaptativos:**
```typescript
// Ejemplo de campo responsive
<div className={cn(
  "space-y-2",
  isMobile ? "col-span-1" : "col-span-2"
)}>
  <Label htmlFor="client">Cliente</Label>
  <Select>
    {/* Opciones */}
  </Select>
</div>
```

### VehicleInfoSection

Sección de información de vehículo con lógica de campos opcionales.

```typescript
import { VehicleInfoSection } from "@/components/services/VehicleInfoSection"
import { shouldShowVehicleInfo } from "@/utils/vehicleHelpers"

// Uso con lógica condicional
{shouldShowVehicleInfo(serviceType) && (
  <VehicleInfoSection
    required={!serviceType?.vehicle_info_optional}
    onVehicleChange={handleVehicleChange}
  />
)}
```

**Lógica de Visualización:**
- Campos mostrados según configuración del tipo de servicio
- Validación condicional basada en requerimientos
- Formateo inteligente de información vehicular

## Componentes de Tablas

### ResponsiveTable

Sistema de tablas que se adapta automáticamente al dispositivo.

```typescript
import { ResponsiveTable } from "@/components/ui/ResponsiveTable"

<ResponsiveTable
  columns={columns}
  data={data}
  mobileCardRender={(item) => (
    <MobileCard key={item.id} item={item} />
  )}
/>
```

**Comportamiento por Dispositivo:**
- **Mobile**: Vista de tarjetas apiladas con información clave
- **Tablet**: Tabla con scroll horizontal suave
- **Desktop**: Tabla completa con todas las columnas visibles

### DataTable

Tabla de datos avanzada con filtros y paginación.

```typescript
import { DataTable } from "@/components/ui/DataTable"

<DataTable
  columns={servicesColumns}
  data={services}
  searchKey="folio"
  filterOptions={filterOptions}
  onRowClick={handleRowClick}
/>
```

**Características Responsivas:**
- Filtros colapsibles en móviles
- Paginación adaptativa
- Búsqueda con debounce optimizado

## Hooks Personalizados

### useDeviceType

Hook principal para detección de dispositivos.

```typescript
import { useDeviceType } from "@/hooks/useDeviceType"

const MyComponent = () => {
  const { 
    deviceType,      // 'mobile' | 'tablet' | 'desktop'
    isMobile,        // boolean
    isTablet,        // boolean  
    isDesktop,       // boolean
    isTouchDevice,   // boolean
    showMobileView,  // boolean
    showTabletView,  // boolean
    showDesktopView  // boolean
  } = useDeviceType()

  return (
    <div className={cn(
      "container",
      isMobile && "px-4",
      isTablet && "px-6", 
      isDesktop && "px-8"
    )}>
      {/* Contenido adaptativo */}
    </div>
  )
}
```

### useBreakpoint

Hook de breakpoints granular.

```typescript
import { useBreakpoint } from "@/hooks/useBreakpoint"

const MyComponent = () => {
  const {
    isMobile,    // < 768px
    isTablet,    // 768px - 1023px
    isDesktop,   // >= 1024px
    isSmall,     // < 640px
    isMedium,    // 640px - 767px
    isLarge,     // 1024px - 1279px
    isXLarge     // >= 1280px
  } = useBreakpoint()

  // Uso para control fino
  if (isSmall) {
    return <CompactMobileView />
  }
  
  if (isMedium) {
    return <StandardMobileView />
  }
  
  return <TabletDesktopView />
}
```

### useForm (Responsive)

Hook de formularios con validaciones adaptativas.

```typescript
import { useForm } from "react-hook-form"
import { useDeviceType } from "@/hooks/useDeviceType"

const MyForm = () => {
  const { isMobile } = useDeviceType()
  
  const form = useForm({
    mode: isMobile ? "onBlur" : "onChange", // Menos intrusivo en móvil
    reValidateMode: "onBlur"
  })

  return (
    <Form {...form}>
      {/* Formulario adaptativo */}
    </Form>
  )
}
```

## Utilidades Responsive

### Funciones de Helpers

```typescript
// utils/deviceHelpers.ts
export const getOptimalImageSize = (deviceType: DeviceType) => {
  switch (deviceType) {
    case 'mobile': return { width: 375, height: 200 }
    case 'tablet': return { width: 768, height: 400 }
    case 'desktop': return { width: 1200, height: 600 }
  }
}

export const getGridColumns = (deviceType: DeviceType, itemCount: number) => {
  if (deviceType === 'mobile') return 1
  if (deviceType === 'tablet') return Math.min(2, itemCount)
  return Math.min(4, itemCount)
}
```

### Classes Utilitarias

```typescript
// utils/classNames.ts
export const responsiveContainer = (isMobile: boolean, isTablet: boolean) => cn(
  "w-full",
  isMobile && "px-4 py-6",
  isTablet && "px-6 py-8", 
  !isMobile && !isTablet && "px-8 py-10"
)

export const responsiveGrid = (deviceType: DeviceType) => cn(
  "grid gap-4",
  deviceType === 'mobile' && "grid-cols-1",
  deviceType === 'tablet' && "grid-cols-2",
  deviceType === 'desktop' && "grid-cols-4"
)
```

## Patrones de Implementación

### 1. Componente Adaptativo Básico

```typescript
const AdaptiveComponent = () => {
  const { deviceType, isMobile, isTablet } = useDeviceType()
  
  return (
    <div className={cn(
      // Base styles
      "flex gap-4",
      // Device-specific layouts
      isMobile && "flex-col",
      isTablet && "flex-row justify-between",
      deviceType === 'desktop' && "grid grid-cols-3"
    )}>
      {/* Content */}
    </div>
  )
}
```

### 2. Renderizado Condicional por Dispositivo

```typescript
const ConditionalComponent = () => {
  const { isMobile, isTablet, isDesktop } = useDeviceType()
  
  if (isMobile) {
    return <MobileOptimizedView />
  }
  
  if (isTablet) {
    return <TabletView />
  }
  
  return <DesktopView />
}
```

### 3. Hook de Estado Responsive

```typescript
const useResponsiveState = <T>(
  mobileDefault: T,
  tabletDefault: T,
  desktopDefault: T
) => {
  const { deviceType } = useDeviceType()
  const [value, setValue] = useState(() => {
    switch (deviceType) {
      case 'mobile': return mobileDefault
      case 'tablet': return tabletDefault
      case 'desktop': return desktopDefault
    }
  })
  
  return [value, setValue] as const
}
```

## Mejores Prácticas

### 1. Performance

- **Lazy loading**: Cargar componentes específicos por dispositivo
- **Bundle splitting**: Separar código móvil/desktop
- **Image optimization**: Usar tamaños apropiados por dispositivo

### 2. Accesibilidad

- **Focus management**: Navegación por teclado adaptativa
- **ARIA labels**: Descripciones contextuales por dispositivo
- **Touch targets**: Mínimo 44px en interfaces táctiles

### 3. Testing

```typescript
// Ejemplo de test responsive
describe('ResponsiveComponent', () => {
  it('renders mobile layout correctly', () => {
    mockDeviceType('mobile')
    render(<ResponsiveComponent />)
    expect(screen.getByTestId('mobile-layout')).toBeInTheDocument()
  })
  
  it('renders desktop layout correctly', () => {
    mockDeviceType('desktop')
    render(<ResponsiveComponent />)
    expect(screen.getByTestId('desktop-layout')).toBeInTheDocument()
  })
})
```

---

Esta guía proporciona una referencia completa para el desarrollo y uso de componentes en TMS Grúas, asegurando consistencia y calidad en toda la aplicación responsive.