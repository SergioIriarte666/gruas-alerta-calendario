# Guía de Contribución - TMS Grúas

## Introducción

¡Gracias por tu interés en contribuir a TMS Grúas! Esta guía te ayudará a configurar tu entorno de desarrollo y seguir las mejores prácticas para contribuir al proyecto.

## Configuración del Entorno de Desarrollo

### Prerrequisitos

- **Node.js** 18+ y npm 8+
- **Git** para control de versiones
- **VSCode** (recomendado) con extensiones:
  - TypeScript y JavaScript Language Features
  - Tailwind CSS IntelliSense
  - ES7+ React/Redux/React-Native snippets
  - Prettier - Code formatter
  - ESLint

### Configuración Inicial

```bash
# 1. Fork del repositorio en GitHub
# 2. Clonar tu fork
git clone https://github.com/tu-usuario/tms-gruas.git
cd tms-gruas

# 3. Agregar repositorio original como upstream
git remote add upstream https://github.com/original/tms-gruas.git

# 4. Instalar dependencias
npm install

# 5. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de desarrollo

# 6. Ejecutar en modo desarrollo
npm run dev
```

## Estructura del Proyecto

### Arquitectura de Carpetas

```
src/
├── components/          # Componentes React organizados por módulo
│   ├── ui/             # Componentes base (shadcn/ui)
│   ├── layout/         # Componentes de layout responsive
│   ├── dashboard/      # Dashboard y métricas
│   ├── services/       # Gestión de servicios
│   ├── cranes/         # Gestión de grúas
│   ├── operators/      # Portal de operadores
│   ├── clients/        # Portal de clientes
│   └── portal/         # Componentes del portal independiente
├── hooks/              # Hooks personalizados
│   ├── useDeviceType.tsx    # Detección de dispositivos
│   ├── useBreakpoint.tsx    # Sistema de breakpoints
│   └── [módulo]/            # Hooks específicos por módulo
├── pages/              # Páginas principales
├── utils/              # Funciones utilitarias
│   ├── statusHelpers.ts     # Helpers de estados
│   ├── vehicleHelpers.ts    # Helpers de vehículos
│   └── deviceHelpers.ts     # Helpers responsive
├── types/              # Definiciones TypeScript
├── schemas/            # Esquemas de validación Zod
└── integrations/       # Integraciones externas (Supabase)
```

### Convenciones de Nombres

```typescript
// Componentes: PascalCase
const ServiceForm = () => { }
const MetricCard = () => { }

// Hooks: camelCase con prefijo "use"
const useDeviceType = () => { }
const useServiceForm = () => { }

// Utilidades: camelCase
const formatVehicleInfo = () => { }
const shouldShowVehicleInfo = () => { }

// Constantes: SCREAMING_SNAKE_CASE
const API_ENDPOINTS = { }
const BREAKPOINTS = { }

// Archivos: kebab-case
// service-form.tsx, device-helpers.ts
```

## Estándares de Código

### TypeScript

```typescript
// ✅ CORRECTO: Interfaces bien definidas
interface ServiceFormData {
  client_id: string
  service_type_id: string
  crane_id: string
  operator_id: string
  // ... más campos
}

// ✅ CORRECTO: Props tipadas
interface MetricCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
}

// ❌ INCORRECTO: Uso de any
const handleData = (data: any) => { }

// ✅ CORRECTO: Tipado específico
const handleData = (data: ServiceFormData) => { }
```

### Componentes React

```typescript
// ✅ CORRECTO: Componente responsive con hooks
const ServiceCard = ({ service }: { service: Service }) => {
  const { isMobile, isTablet } = useDeviceType()
  
  return (
    <div className={cn(
      "bg-card rounded-lg p-4",
      isMobile && "p-3",
      isTablet && "p-5"
    )}>
      {/* Contenido del componente */}
    </div>
  )
}

// ✅ CORRECTO: Export por defecto
export default ServiceCard

// ✅ CORRECTO: Componente con memo para performance
export const ExpensiveComponent = memo(({ data }: Props) => {
  // Componente costoso
}, (prevProps, nextProps) => {
  return prevProps.data.id === nextProps.data.id
})
```

### Responsive Design

```typescript
// ✅ CORRECTO: Uso de hooks responsive
const ResponsiveComponent = () => {
  const { deviceType, isMobile, isTablet } = useDeviceType()
  
  return (
    <div className={cn(
      "grid gap-4",
      isMobile && "grid-cols-1",
      isTablet && "grid-cols-2",
      deviceType === 'desktop' && "grid-cols-4"
    )}>
      {/* Contenido adaptativo */}
    </div>
  )
}

// ❌ INCORRECTO: Hardcoded breakpoints
const BadComponent = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  // No hacer esto - usar hooks existentes
}
```

### Hooks Personalizados

```typescript
// ✅ CORRECTO: Hook reutilizable con TypeScript
export const useServiceData = (serviceId: string) => {
  const { data, loading, error } = useQuery({
    queryKey: ['service', serviceId],
    queryFn: () => fetchService(serviceId),
    enabled: !!serviceId
  })
  
  return {
    service: data,
    loading,
    error,
    refetch: () => queryClient.invalidateQueries(['service', serviceId])
  }
}

// ✅ CORRECTO: Hook responsive específico
export const useOptimalLayout = (itemCount: number) => {
  const { deviceType } = useDeviceType()
  
  return useMemo(() => {
    if (deviceType === 'mobile') return { columns: 1, spacing: 'tight' }
    if (deviceType === 'tablet') return { columns: 2, spacing: 'normal' }
    return { columns: Math.min(4, itemCount), spacing: 'wide' }
  }, [deviceType, itemCount])
}
```

## Flujo de Desarrollo

### 1. Crear Nueva Rama

```bash
# Sincronizar con upstream
git fetch upstream
git checkout main
git merge upstream/main

# Crear rama de feature
git checkout -b feature/nueva-funcionalidad
# o
git checkout -b fix/correccion-bug
# o
git checkout -b docs/actualizacion-documentacion
```

### 2. Desarrollo

```bash
# Ejecutar en modo desarrollo
npm run dev

# Tests en paralelo
npm run test

# Verificar tipos
npm run type-check

# Lint y formato
npm run lint
npm run format
```

### 3. Commits

```bash
# Convención de commits (Conventional Commits)
git commit -m "feat: add responsive navigation component"
git commit -m "fix: resolve mobile layout issue in ServiceForm"
git commit -m "docs: update component documentation"
git commit -m "test: add tests for useDeviceType hook"
git commit -m "refactor: improve responsive helpers performance"
```

### Tipos de Commits

- `feat`: Nueva funcionalidad
- `fix`: Corrección de bugs
- `docs`: Cambios en documentación
- `style`: Cambios de formato (no afectan lógica)
- `refactor`: Refactoring de código
- `test`: Agregar o modificar tests
- `chore`: Cambios en build, dependencias, etc.

### 4. Pull Request

```bash
# Push de la rama
git push origin feature/nueva-funcionalidad

# Crear PR en GitHub con:
# - Título descriptivo
# - Descripción detallada de cambios
# - Screenshots si hay cambios UI
# - Tests realizados
# - Referencias a issues
```

## Testing

### Tests de Componentes

```typescript
// Ejemplo de test responsive
describe('MetricCard', () => {
  it('adapts layout for mobile devices', () => {
    mockDeviceType('mobile')
    
    render(<MetricCard title="Test" value="100" icon={DollarSign} />)
    
    const card = screen.getByTestId('metric-card')
    expect(card).toHaveClass('flex-col') // Mobile layout
  })
  
  it('shows full information on desktop', () => {
    mockDeviceType('desktop')
    
    render(<MetricCard 
      title="Test" 
      value="100" 
      icon={DollarSign}
      trend={{ value: 10, isPositive: true }}
    />)
    
    expect(screen.getByText('10%')).toBeInTheDocument()
  })
})
```

### Tests de Hooks

```typescript
describe('useDeviceType', () => {
  it('returns correct device type for mobile', () => {
    mockWindowWidth(375)
    
    const { result } = renderHook(() => useDeviceType())
    
    expect(result.current.deviceType).toBe('mobile')
    expect(result.current.isMobile).toBe(true)
    expect(result.current.isTouchDevice).toBe(true)
  })
})
```

## Responsive Design Guidelines

### Breakpoints del Sistema

```typescript
const breakpoints = {
  sm: '640px',   // Móviles grandes
  md: '768px',   // Tablets
  lg: '1024px',  // Laptops
  xl: '1280px',  // Desktops
  '2xl': '1536px' // Pantallas grandes
}
```

### Uso de Hooks Responsive

```typescript
// ✅ CORRECTO: Usar hooks del sistema
const { isMobile, isTablet, isDesktop } = useDeviceType()

// ✅ CORRECTO: Control granular
const { isSmall, isMedium, isLarge } = useBreakpoint()

// ❌ INCORRECTO: Window queries manuales
const isMobile = window.innerWidth < 768
```

### Touch-Friendly Design

```tsx
<Button className="min-h-11 min-w-11 p-2">Acción</Button>
<div className="flex gap-2">...</div>
```

Las decisiones visuales adicionales deben seguir `docs/design-system.md`.

## Estándares de Calidad

### Code Review Checklist

#### Funcionalidad
- [ ] El código hace lo que dice que hace
- [ ] No hay funcionalidad rota
- [ ] Maneja errores apropiadamente
- [ ] Performance acceptable

#### Responsive Design
- [ ] Funciona en móvil, tablet y desktop
- [ ] Usa hooks responsive del sistema
- [ ] Elementos táctiles de tamaño apropiado
- [ ] No hay overflow horizontal en móvil

#### TypeScript
- [ ] Tipos correctos y completos
- [ ] No uso de `any`
- [ ] Interfaces bien definidas
- [ ] Imports/exports correctos

#### Testing
- [ ] Tests unitarios para nueva funcionalidad
- [ ] Tests responsive para componentes UI
- [ ] Tests pasan en CI/CD
- [ ] Coverage adequate

#### Documentación
- [ ] Código autoexplicativo
- [ ] Comentarios donde es necesario
- [ ] Documentación actualizada
- [ ] README actualizado si es necesario

## Debugging

### DevTools Responsive

```typescript
// Utility para debugging en desarrollo
const DeviceDebugInfo = () => {
  const device = useDeviceType()
  
  if (process.env.NODE_ENV === 'development') {
    return (
      <div className="fixed right-0 top-0 z-50 bg-danger p-2 text-xs text-danger-foreground">
        {device.deviceType} - {window.innerWidth}px
      </div>
    )
  }
  return null
}
```

### Console Debugging

```typescript
// Debug hooks responsive
const { deviceType, isMobile } = useDeviceType()
console.log('Device info:', { deviceType, isMobile, width: window.innerWidth })

// Debug componente rendering
useEffect(() => {
  console.log('Component mounted:', { props, state })
}, [])
```

## Deployment y CI/CD

### Build Process

```bash
# Verificar que el build pasa
npm run build

# Preview del build
npm run preview

# Tests completos
npm run test:run
npm run test:coverage
```

### Environment Variables

```bash
# Desarrollo
VITE_SUPABASE_URL=https://dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=dev_key

# Producción  
VITE_SUPABASE_URL=https://prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=prod_key
```

## Recursos y Herramientas

### Documentación de Referencia
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Shadcn/ui](https://ui.shadcn.com)
- [Supabase Docs](https://supabase.com/docs)

### Herramientas de Desarrollo
- [React DevTools](https://chrome.google.com/webstore/detail/react-developer-tools/)
- [Redux DevTools](https://chrome.google.com/webstore/detail/redux-devtools/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)

### Testing Responsive
- Chrome DevTools Device Mode
- [Responsively App](https://responsively.app)
- [BrowserStack](https://www.browserstack.com) para testing en dispositivos reales

## Soporte

### Canales de Comunicación
- **Issues**: Reportar bugs y solicitar features en GitHub
- **Discussions**: Preguntas generales y discusiones
- **Slack/Discord**: Comunicación rápida del equipo

### Reportar Bugs

```markdown
## Bug Report

**Descripción:**
Descripción clara del problema

**Pasos para Reproducir:**
1. Paso 1
2. Paso 2
3. Paso 3

**Comportamiento Esperado:**
Lo que debería pasar

**Comportamiento Actual:**
Lo que realmente pasa

**Entorno:**
- OS: [Windows/Mac/Linux]
- Browser: [Chrome/Firefox/Safari]
- Device: [Desktop/Mobile/Tablet]
- Screen size: [1920x1080/375x667/etc]

**Screenshots:**
Si aplica, agregar screenshots
```

---

¡Gracias por contribuir a TMS Grúas! Tu ayuda hace que el proyecto sea mejor para todos.
