
# Sistema Visual y de Temas - TMS Grúas

## Introducción al Sistema Visual

El sistema TMS Grúas implementa un **tema blanco forzado** con acentos en verde (`#9cfa24`). Esta decisión de diseño asegura consistencia visual y legibilidad óptima en todos los componentes.

### Filosofía de Diseño
- **Tema único**: Solo tema claro, sin modo oscuro
- **Consistencia**: Todos los componentes siguen las mismas reglas visuales
- **Accesibilidad**: Alto contraste entre texto negro y fondo blanco
- **Branding**: Color verde corporativo como acento principal

### Tecnologías Utilizadas
- **Tailwind CSS**: Framework principal de estilos
- **CSS Variables**: Variables personalizadas para consistencia
- **Radix UI**: Componentes base con estilos personalizados
- **Shadcn/ui**: Sistema de componentes con tema personalizado

---

## Arquitectura del Sistema de Temas

### Archivos Principales

#### 1. `src/index.css` (365 líneas)
**Archivo central del sistema visual**

```css
/* Variables CSS globales */
:root {
  --background: 255 255 255;        /* Fondo blanco */
  --foreground: 0 0 0;             /* Texto negro */
  --primary: 156 250 36;           /* Verde TMS */
  --tms-green: 156 250 36;         /* Color corporativo */
}

/* Forzar tema claro */
html {
  @apply light;
  background: #ffffff !important;
}

body {
  background: #ffffff !important;
  color: #000000 !important;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

**Líneas críticas:**
- **Líneas 8-24**: Variables CSS para colores del tema
- **Líneas 38-50**: Forzado de tema claro en elementos raíz
- **Líneas 58-70**: Estilos de scrollbar personalizados
- **Líneas 75-90**: Clases universales para texto negro

#### 2. `src/hooks/useTheme.ts` (76 líneas)
**Hook que fuerza el tema claro**

```typescript
export const useTheme = () => {
  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      const body = document.body;
      
      // Forzar tema claro siempre (líneas 9-12)
      root.classList.remove('dark');
      root.classList.add('light');
      body.classList.remove('dark');
      body.classList.add('light');

      // Variables CSS para tema claro (líneas 15-31)
      root.style.setProperty('--background', '#ffffff');
      root.style.setProperty('--foreground', '#000000');
      root.style.setProperty('--primary', '#9cfa24');
    };
  }, []);

  // Retorna siempre tema claro (línea 74)
  return {
    theme: 'light' as const,
    setTheme
  };
};
```

#### 3. `tailwind.config.ts` (142 líneas)
**Configuración de colores personalizados**

```typescript
colors: {
  // Colores TMS optimizados para tema claro (líneas 35-47)
  tms: {
    dark: '#ffffff',          // Convertido a blanco
    darker: '#ffffff',        // Convertido a blanco
    green: '#9cfa24',         // Verde corporativo
    'green-light': '#9cfa24',
    'green-dark': '#9cfa24',
    status: {
      pending: '#f59e0b',     // Amarillo para pendientes
      closed: '#3b82f6',      // Azul para cerrados
      invoiced: '#10b981',    // Verde para facturados
      overdue: '#ef4444'      // Rojo para vencidos
    }
  }
}
```

#### 4. `src/components/layout/Layout.tsx` (73 líneas)
**Layout principal con forzado de tema**

```typescript
export const Layout = ({ children }: LayoutProps) => {
  // Asegurar tema blanco al cargar (líneas 12-16)
  React.useEffect(() => {
    document.body.style.backgroundColor = '#ffffff';
    document.body.style.color = '#000000';
    document.documentElement.style.colorScheme = 'light';
  }, []);

  return (
    <div 
      className="min-h-screen w-full bg-white text-black"
      style={{
        background: '#ffffff',
        color: '#000000'
      }}
    >
```

---

## Componentes UI Detallados

### Formularios

#### Input (`src/components/ui/input.tsx`)
```typescript
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        className={cn(
          "bg-white border-gray-300 text-black placeholder:text-gray-500",
          className
        )}
        style={{
          background: '#ffffff',      // Línea 15
          color: '#000000',          // Línea 16
          borderColor: '#d1d5db'     // Línea 17
        }}
      />
    )
  }
)
```

#### Select (`src/components/ui/select.tsx`)
```typescript
const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    className={cn(
      "bg-white border-gray-300 text-black",  // Línea 12
      className
    )}
    style={{ 
      background: '#ffffff',    // Línea 16
      color: '#000000',        // Línea 17
      borderColor: '#d1d5db'   // Línea 18
    }}
  >
```

#### Textarea (`src/components/ui/textarea.tsx`)
```typescript
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "bg-white border-gray-300 text-black placeholder:text-gray-500",
          className
        )}
        style={{
          background: '#ffffff',      // Línea 15
          color: '#000000',          // Línea 16
          borderColor: '#d1d5db'     // Línea 17
        }}
      />
    )
  }
)
```

#### Label (`src/components/ui/label.tsx`)
```typescript
const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-black"  // Línea 9
)

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    className={cn(labelVariants(), className)}
    style={{ color: '#000000' }}  // Línea 18
  />
))
```

### Controles Interactivos

#### Switch (`src/components/ui/switch.tsx`)
```typescript
const Switch = React.forwardRef(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "data-[state=unchecked]:bg-gray-200 data-[state=checked]:bg-tms-green",  // Línea 12
      className
    )}
    style={{
      backgroundColor: props.checked ? '#9cfa24' : '#e5e7eb'  // Línea 17
    }}
  >
    <SwitchPrimitives.Thumb
      className={cn("bg-white")}  // Línea 22
      style={{ backgroundColor: '#ffffff' }}  // Línea 23
    />
  </SwitchPrimitives.Root>
))
```

#### Toggle (`src/components/ui/toggle.tsx`)
```typescript
const toggleVariants = cva(
  "bg-transparent text-black border border-gray-300 hover:bg-gray-50",  // Línea 12
  {
    variants: {
      default: "bg-transparent text-black border border-gray-300 hover:bg-gray-50",
      outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground text-black",
    }
  }
)
```

### Layout y Navegación

#### Header (`src/components/layout/Header.tsx`)
```typescript
return (
  <header className="flex h-16 items-center justify-between bg-white border-b border-gray-200 px-4 sm:px-6">  // Línea 41
    {/* Botón de menú móvil */}
    <Button 
      variant="ghost" 
      size="icon" 
      className="lg:hidden text-black bg-tms-green/20 border border-tms-green/30 hover:bg-tms-green hover:text-black"  // Línea 46
    >

    {/* Dropdown de usuario */}
    <DropdownMenuContent 
      align="end" 
      className="bg-white border-gray-200 min-w-[200px] z-50"  // Línea 74
    >
```

#### Sidebar (`src/components/layout/Sidebar.tsx`)
```typescript
const SidebarContent = () => (
  <div className="flex flex-col h-full bg-white border-r border-gray-200">  // Línea 52
    {/* Header de la empresa */}
    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">  // Línea 56

    {/* Navegación */}
    <nav className="flex-1 p-4 space-y-2 bg-white">  // Línea 85
      {filteredNavigation.map(item => (
        <NavLink 
          className={({ isActive: linkIsActive }) => cn(
            "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors nav-link",
            linkIsActive || isActive(item.href) ? 
              "active bg-tms-green text-black" :   // Línea 91
              "text-black hover:bg-tms-green hover:text-black"  // Línea 92
          )}
        >
```

### Componentes de Dashboard

#### MetricCard (`src/components/dashboard/MetricCard.tsx`)
```typescript
return (
  <Card 
    className={cardClasses}
    style={{ background: '#ffffff', color: '#000000' }}  // Línea 39
  >
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>  // Línea 43
        <h3 className="text-2xl font-bold text-black">{value}</h3>  // Línea 45
        
        <div className="p-3 bg-tms-green/20 rounded-lg group-hover:bg-tms-green/30 transition-colors">  // Línea 53
          <Icon className="w-6 h-6 text-tms-green" />  // Línea 54
        </div>
      </div>
    </div>
  </Card>
);
```

#### AlertsPanel (`src/components/dashboard/AlertsPanel.tsx`)
```typescript
return (
  <Card className="bg-white border border-gray-200" style={{ background: '#ffffff', color: '#000000' }}>  // Línea 38
    <CardHeader>
      <CardTitle className="flex items-center space-x-2 text-black">  // Línea 40
        <AlertTriangle className="w-5 h-5 text-tms-green" />  // Línea 41
        <span>Alertas y Recordatorios</span>
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      {events.length === 0 ? (
        <div className="text-center py-8 text-gray-600">  // Línea 47
```

### Componentes de Configuración

#### UserManagementTab (`src/components/settings/UserManagementTab.tsx`)
```typescript
return (
  <Card className="bg-white border-gray-300">  // Línea 39
    <CardHeader>
      <CardTitle className="text-black">Gestión de Usuarios</CardTitle>  // Línea 42
      <CardDescription className="text-gray-600">  // Línea 43
        Administra los usuarios y sus roles en el sistema
      </CardDescription>
      
      <Button
        variant="outline"
        className="border-gray-300 text-black hover:bg-gray-50"  // Línea 52
      >

    <Table>
      <TableHeader>
        <TableRow className="border-gray-300 hover:bg-gray-50">  // Línea 61
          <TableHead className="text-black font-medium">Usuario</TableHead>  // Línea 62
```

---

## Configuración Global en CSS

### Variables CSS Principales (`src/index.css`)

```css
/* Líneas 8-31: Variables del tema claro */
:root {
  --background: 255 255 255;         /* HSL: Blanco puro */
  --foreground: 0 0 0;              /* HSL: Negro puro */
  --card: 255 255 255;              /* HSL: Blanco para cards */
  --card-foreground: 0 0 0;         /* HSL: Negro para texto en cards */
  --primary: 156 250 36;            /* HSL: Verde TMS */
  --primary-foreground: 0 0 0;      /* HSL: Negro sobre verde */
  --secondary: 248 250 252;         /* HSL: Gris muy claro */
  --muted: 248 250 252;             /* HSL: Gris suave */
  --muted-foreground: 71 85 105;    /* HSL: Gris medio */
  --border: 226 232 240;            /* HSL: Gris para bordes */
  --input: 255 255 255;             /* HSL: Blanco para inputs */
  --ring: 156 250 36;               /* HSL: Verde para focus ring */
  --tms-green: 156 250 36;          /* HSL: Color corporativo */
}

/* Líneas 75-85: Texto negro universal */
.tms-text-black,
.tms-text-black *,
p, span, div, h1, h2, h3, h4, h5, h6, td, th, label,
input, textarea, select,
[data-radix-select-trigger],
[data-radix-select-trigger] *,
[data-radix-select-value],
[data-radix-select-content],
[data-radix-select-item],
[role="combobox"],
[role="combobox"] * {
  color: #000000 !important;
}

/* Líneas 87-97: Botones con texto negro */
button,
button *,
[role="button"],
[role="button"] *,
.bg-tms-green,
.bg-tms-green *,
.bg-green-500,
.bg-green-500 * {
  color: #000000 !important;
}

/* Líneas 140-155: Navegación */
.nav-link {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  color: #000000 !important;
  transition: all 0.2s;
}

.nav-link:hover {
  background: rgb(156, 250, 36) !important;
  color: #000000 !important;
}

.nav-link.active {
  background: rgb(156, 250, 36) !important;
  color: #000000 !important;
  font-weight: 500;
}

/* Líneas 200-230: Overrides para componentes Radix */
[data-radix-select-trigger] {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  color: #000000 !important;
}

[data-radix-select-content] {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  color: #000000 !important;
  z-index: 50 !important;
}

[data-radix-select-item]:hover {
  background: rgba(156, 250, 36, 0.1) !important;
  color: #000000 !important;
}
```

---

## Estados y Badges de Estado

### Status Classes (`src/index.css` líneas 157-175)
```css
.status-badge {
  @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
}

.status-pending {
  @apply bg-amber-100 text-amber-800 border border-amber-200;
}

.status-closed {
  @apply bg-blue-100 text-blue-800 border border-blue-200;
}

.status-invoiced {
  @apply bg-emerald-100 text-emerald-800 border border-emerald-200;
}

.status-overdue {
  @apply bg-red-100 text-red-800 border border-red-200;
}
```

### Implementación en Componentes
Los badges de estado se utilizan principalmente en:
- Tablas de servicios
- Dashboard de métricas
- Gestión de usuarios
- Estados de facturas

---

## Troubleshooting Visual

### Problemas Comunes

#### 1. **Texto invisible o poco visible**
**Síntoma**: Texto que no se ve o se ve muy tenue
**Causa**: Falta de override de color en componentes específicos
**Solución**: Agregar `style={{ color: '#000000' }}` o clase `text-black`

```typescript
// ❌ Problemático
<div className="some-class">
  {text}
</div>

// ✅ Correcto
<div className="some-class" style={{ color: '#000000' }}>
  {text}
</div>

// ✅ O con clase
<div className="some-class text-black">
  {text}
</div>
```

#### 2. **Fondos transparentes en dropdowns**
**Síntoma**: Menús desplegables que se ven transparentes
**Causa**: Falta de override de background en componentes Radix
**Solución**: Forzar background blanco con alta especificidad

```css
[data-radix-select-content] {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  z-index: 50 !important;
}
```

#### 3. **Botones sin contraste**
**Síntoma**: Botones que no se distinguen del fondo
**Causa**: Falta de estilos específicos para estados hover/active
**Solución**: Usar clases con el patrón TMS

```typescript
// ✅ Patrón correcto para botones
className="text-black bg-tms-green/20 border border-tms-green/30 hover:bg-tms-green hover:text-black"
```

### Herramientas de Debugging

#### 1. **Inspección de CSS Variables**
En DevTools Console:
```javascript
// Verificar variables CSS
const root = document.documentElement;
console.log('Background:', getComputedStyle(root).getPropertyValue('--background'));
console.log('TMS Green:', getComputedStyle(root).getPropertyValue('--tms-green'));
```

#### 2. **Verificación de Clases Aplicadas**
```javascript
// Verificar si el tema se aplicó correctamente
console.log('Body classes:', document.body.classList);
console.log('Root classes:', document.documentElement.classList);
console.log('Body background:', getComputedStyle(document.body).backgroundColor);
```

#### 3. **Detección de Overrides**
```css
/* Agregar temporalmente para debugging */
* {
  border: 1px solid red !important;
  background: rgba(255, 0, 0, 0.1) !important;
}
```

---

## Guía de Mantenimiento

### Checklist para Nuevos Componentes

#### ✅ **Formularios**
- [ ] Input tiene `bg-white border-gray-300 text-black`
- [ ] Placeholder usa `placeholder:text-gray-500`
- [ ] Focus ring usa `focus:border-tms-green focus:ring-tms-green`
- [ ] Style inline: `background: '#ffffff', color: '#000000'`

#### ✅ **Botones**
- [ ] Texto siempre negro: `text-black`
- [ ] Hover usa verde TMS: `hover:bg-tms-green hover:text-black`
- [ ] Estados activos usan `bg-tms-green text-black`
- [ ] Variants outline mantienen `text-black`

#### ✅ **Cards y Contenedores**
- [ ] Fondo blanco: `bg-white`
- [ ] Bordes grises: `border-gray-200` o `border-gray-300`
- [ ] Texto principal: `text-black`
- [ ] Texto secundario: `text-gray-600`

#### ✅ **Navegación**
- [ ] Links usan clase `.nav-link`
- [ ] Estados activos: `bg-tms-green text-black`
- [ ] Hover: `hover:bg-tms-green hover:text-black`

### Reglas de Oro

#### 1. **Siempre Fondo Blanco**
Todos los componentes deben tener fondo blanco explícito:
```typescript
style={{ background: '#ffffff' }}
className="bg-white"
```

#### 2. **Siempre Texto Negro**
Todo texto debe ser negro para máximo contraste:
```typescript
style={{ color: '#000000' }}
className="text-black"
```

#### 3. **Verde TMS como Acento**
Usar `#9cfa24` solo para:
- Estados activos
- Hover states
- Iconos de acción
- Elementos de navegación activos

#### 4. **Grises para Texto Secundario**
```css
text-gray-600  /* Texto secundario */
text-gray-500  /* Placeholders */
text-gray-400  /* Texto deshabilitado */
```

### Testing Visual

#### 1. **Test de Contraste**
Verificar que todos los elementos tienen suficiente contraste:
- Texto negro sobre fondo blanco ✅
- Verde TMS sobre fondo blanco ✅
- Texto blanco sobre verde TMS ❌ (usar texto negro)

#### 2. **Test de Consistencia**
Revisar que todos los componentes del mismo tipo se ven igual:
- Todos los inputs tienen el mismo estilo
- Todos los botones primarios usan verde TMS
- Todos los cards tienen fondo blanco

#### 3. **Test de Estados**
Verificar todos los estados interactivos:
- Hover: cambio a verde TMS
- Active: mantiene verde TMS
- Focus: ring verde TMS
- Disabled: texto gris, fondo gris claro

---

## Modificaciones Futuras

### Cómo Agregar Nuevos Colores

#### 1. **En tailwind.config.ts**
```typescript
colors: {
  tms: {
    // Agregar nuevos colores aquí
    'new-color': '#hexcode',
  }
}
```

#### 2. **En index.css (si necesario)**
```css
:root {
  --new-color: R G B; /* Valores RGB separados por espacios */
}
```

### Cómo Modificar el Color Principal

#### 1. **Cambiar en todas las ubicaciones**
- `tailwind.config.ts` línea 39: `green: '#nuevo-color'`
- `index.css` línea 23: `--primary: R G B`
- `index.css` línea 31: `--tms-green: R G B`
- `useTheme.ts` línea 17: `--primary', '#nuevo-color'`

#### 2. **Verificar todos los componentes**
Buscar y reemplazar todas las referencias a:
- `text-tms-green`
- `bg-tms-green`
- `border-tms-green`
- `#9cfa24`

### Versionado del Sistema Visual

El archivo `index.css` incluye un comentario de versión:
```css
/* CACHE BUSTING - VERSION 4.0 LIGHT THEME */
.tms-version-4-light {
  display: none;
}
```

Al hacer cambios mayores, incrementar la versión para forzar actualización de cache.

---

## Conclusión

Este sistema visual garantiza:
- **Consistencia**: Todos los componentes siguen las mismas reglas
- **Accesibilidad**: Alto contraste y legibilidad
- **Mantenibilidad**: Código organizado y documentado
- **Escalabilidad**: Fácil agregar nuevos componentes respetando el tema

El sistema está diseñado para ser robusto y fácil de mantener, con overrides específicos que aseguran que el tema blanco se mantenga independientemente de los estilos por defecto de las librerías externas.
