
# Sistema Visual y de Temas - TMS Grúas

## Introducción al Sistema Visual

El sistema TMS Grúas implementa un **tema oscuro elegante** con fondo negro profundo, texto blanco y acentos en verde brillante (`#9cfa24`). Esta decisión de diseño asegura una experiencia visual moderna, elegante y de alta legibilidad.

### Filosofía de Diseño
- **Tema único**: Solo tema oscuro elegante, sin modo claro
- **Consistencia**: Todos los componentes siguen las mismas reglas visuales
- **Accesibilidad**: Alto contraste entre texto blanco y fondo negro
- **Branding**: Color verde brillante corporativo como acento principal
- **Elegancia**: Fondo negro profundo con efectos glass sutiles

### Tecnologías Utilizadas
- **Tailwind CSS**: Framework principal de estilos
- **CSS Variables**: Variables personalizadas para consistencia
- **Radix UI**: Componentes base con estilos personalizados
- **Shadcn/ui**: Sistema de componentes con tema personalizado

---

## Arquitectura del Sistema de Temas

### Archivos Principales

#### 1. `src/index.css` (213 líneas)
**Archivo central del sistema visual**

```css
/* Variables CSS globales */
:root {
  --background: 0 0 0;             /* Fondo negro profundo */
  --foreground: 255 255 255;       /* Texto blanco */
  --primary: 156 250 36;           /* Verde TMS brillante */
  --tms-green: 156 250 36;         /* Color corporativo */
  --tms-dark: 0 0 0;              /* Negro profundo */
}

/* Forzar tema oscuro */
html {
  background: #000000 !important;
}

body {
  background: #000000 !important;
  color: #ffffff !important;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

**Líneas críticas:**
- **Líneas 8-24**: Variables CSS para colores del tema oscuro
- **Líneas 32-44**: Forzado de tema oscuro en elementos raíz
- **Líneas 58-70**: Estilos de scrollbar personalizados con verde brillante
- **Líneas 75-90**: Efectos glass para componentes

#### 2. `src/hooks/useTheme.ts` (76 líneas)
**Hook que fuerza el tema oscuro**

```typescript
export const useTheme = () => {
  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      const body = document.body;
      
      // Forzar tema oscuro siempre (líneas 9-12)
      root.classList.remove('light');
      root.classList.add('dark');
      body.classList.remove('light');
      body.classList.add('dark');

      // Variables CSS para tema oscuro (líneas 15-31)
      root.style.setProperty('--background', '0 0 0');
      root.style.setProperty('--foreground', '255 255 255');
      root.style.setProperty('--primary', '156 250 36');
    };
  }, []);

  // Retorna siempre tema oscuro (línea 74)
  return {
    theme: 'dark' as const,
    setTheme
  };
};
```

#### 3. `tailwind.config.ts` (142 líneas)
**Configuración de colores personalizados**

```typescript
colors: {
  // Colores TMS optimizados para tema oscuro (líneas 35-47)
  tms: {
    dark: '#000000',          // Negro profundo
    darker: '#0f172a',        // Negro más profundo
    green: '#9cfa24',         // Verde brillante corporativo
    'green-light': '#9cfa24',
    'green-dark': '#8ae620',
    status: {
      pending: '#f59e0b',     // Amarillo para pendientes
      closed: '#3b82f6',      // Azul para cerrados
      invoiced: '#10b981',    // Verde para facturados
      overdue: '#ef4444'      // Rojo para vencidos
    }
  }
}
```

#### 4. `src/components/layout/Layout.tsx` (36 líneas)
**Layout principal con tema oscuro**

```typescript
export const Layout = () => {
  // Asegurar tema oscuro al cargar (líneas 12-16)
  React.useEffect(() => {
    document.body.style.backgroundColor = '#000000';
    document.body.style.color = '#ffffff';
    document.documentElement.style.colorScheme = 'dark';
  }, []);

  return (
    <div className="min-h-screen bg-tms-dark text-white flex">
```

---

## Componentes UI Detallados

### Tarjetas y Contenedores

#### Glass Cards (`src/index.css` líneas 75-85)
```css
.glass-card {
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(156, 250, 36, 0.2);
  border-radius: 8px;
  backdrop-filter: blur(10px);
  transition: all 0.3s;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
}
```

#### MetricCard (`src/components/dashboard/MetricCard.tsx`)
```typescript
const MetricCard = ({ title, value, icon: Icon, ... }) => {
  return (
    <Card className="metric-card group p-4 sm:p-6 h-full">
      <div className="flex items-start justify-between space-x-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-400 mb-1">{title}</p>
          <h3 className="text-lg font-bold text-white">{value}</h3>
        </div>
        <div className="p-3 bg-tms-green/20 rounded-lg">
          <Icon className="w-6 h-6 text-tms-green" />
        </div>
      </div>
    </Card>
  );
};
```

### Navegación

#### Sidebar (`src/components/layout/Sidebar.tsx`)
```typescript
const SidebarContent = () => (
  <div className="flex flex-col h-full bg-tms-dark border-r border-gray-700">
    {/* Header de la empresa */}
    <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-tms-dark">
      <div className="flex items-center space-x-3">
        <h1 className="text-lg font-bold text-white">{companyName}</h1>
        <p className="text-xs font-bold text-tms-green">Sistema de Gestión</p>
      </div>
    </div>

    {/* Navegación */}
    <nav className="flex-1 p-4 space-y-2 bg-tms-dark">
      {filteredNavigation.map(item => (
        <Link 
          className={cn(
            "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors nav-link",
            isActive 
              ? "active bg-tms-green text-black" 
              : "text-white hover:bg-tms-green hover:text-black"
          )}
        >
```

### Dropdowns y Menús

#### Dropdown Styling (`src/index.css` líneas 175-190)
```css
[data-radix-popper-content-wrapper] {
  background: rgba(15, 23, 42, 0.95) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(51, 65, 85, 0.5) !important;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
  z-index: 50 !important;
}

[data-radix-dropdown-menu-content] {
  background: rgba(15, 23, 42, 0.95) !important;
  border: 1px solid rgba(51, 65, 85, 0.5) !important;
  color: #ffffff !important;
}
```

### Tablas y Datos

#### CostsTable (`src/components/costs/CostsTable.tsx`)
```typescript
return (
  <Card className="glass-card">
    <CardContent className="p-0">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-700 hover:bg-white/5">
            <TableHead className="text-white">Fecha</TableHead>
            <TableHead className="text-white">Descripción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {costs.map((cost) => (
            <TableRow key={cost.id} className="border-gray-800 hover:bg-white/5">
              <TableCell className="text-white">{cost.date}</TableCell>
              <TableCell className="text-white font-medium">{cost.description}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);
```

---

## Paleta de Colores

### Colores Principales
- **Fondo principal**: `#000000` (Negro profundo)
- **Texto principal**: `#ffffff` (Blanco puro)
- **Acento principal**: `#9cfa24` (Verde brillante TMS)
- **Bordes**: `rgba(51, 65, 85, 0.5)` (Gris translúcido)

### Colores de Glass Effects
- **Glass cards**: `rgba(30, 41, 59, 0.8)` (Azul oscuro translúcido)
- **Hover effects**: `rgba(156, 250, 36, 0.1)` (Verde translúcido)
- **Dropdowns**: `rgba(15, 23, 42, 0.95)` (Azul muy oscuro)

### Colores de Estado
- **Pendiente**: `#f59e0b` (Amarillo)
- **Cerrado**: `#3b82f6` (Azul)
- **Facturado**: `#10b981` (Verde)
- **Vencido**: `#ef4444` (Rojo)

---

## Configuración Global en CSS

### Variables CSS Principales (`src/index.css`)

```css
/* Líneas 8-31: Variables del tema oscuro */
:root {
  --background: 0 0 0;              /* HSL: Negro profundo */
  --foreground: 255 255 255;        /* HSL: Blanco puro */
  --card: 15 23 42;                 /* HSL: Azul muy oscuro para cards */
  --card-foreground: 255 255 255;   /* HSL: Blanco para texto en cards */
  --primary: 156 250 36;            /* HSL: Verde TMS brillante */
  --primary-foreground: 0 0 0;      /* HSL: Negro sobre verde */
  --secondary: 30 41 59;            /* HSL: Azul oscuro */
  --muted: 30 41 59;                /* HSL: Azul oscuro suave */
  --muted-foreground: 148 163 184;  /* HSL: Gris claro */
  --border: 51 65 85;               /* HSL: Gris para bordes */
  --input: 30 41 59;                /* HSL: Azul oscuro para inputs */
  --ring: 156 250 36;               /* HSL: Verde para focus ring */
  --tms-green: 156 250 36;          /* HSL: Color corporativo */
  --tms-dark: 0 0 0;                /* HSL: Negro profundo */
}

/* Líneas 87-97: Navegación */
.nav-link {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  color: #ffffff;
  transition: all 0.2s;
}

.nav-link:hover {
  background: rgba(156, 250, 36, 0.1);
  color: rgb(156, 250, 36);
}

.nav-link.active {
  background: rgba(156, 250, 36, 0.15);
  color: rgb(156, 250, 36);
  font-weight: 500;
}
```

---

## Estados y Badges de Estado

### Status Classes (`src/index.css` líneas 110-125)
```css
.status-badge {
  @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
}

.status-pending {
  @apply bg-amber-900/20 text-amber-400 border border-amber-800;
}

.status-closed {
  @apply bg-blue-900/20 text-blue-400 border border-blue-800;
}

.status-invoiced {
  @apply bg-emerald-900/20 text-emerald-400 border border-emerald-800;
}

.status-overdue {
  @apply bg-red-900/20 text-red-400 border border-red-800;
}
```

---

## Troubleshooting Visual

### Problemas Comunes

#### 1. **Dropdowns transparentes o mal posicionados**
**Síntoma**: Menús desplegables que se ven transparentes o no tienen el fondo correcto
**Causa**: Falta de override de background en componentes Radix
**Solución**: Asegurar que tengan `background: rgba(15, 23, 42, 0.95) !important` y `z-index: 50 !important`

```css
[data-radix-dropdown-menu-content] {
  background: rgba(15, 23, 42, 0.95) !important;
  border: 1px solid rgba(51, 65, 85, 0.5) !important;
  color: #ffffff !important;
  z-index: 50 !important;
}
```

#### 2. **Componentes con fondos blancos**
**Síntoma**: Algunos componentes aparecen con fondos blancos rompiendo el tema
**Causa**: Estilos inline o clases que fuerzan fondos blancos
**Solución**: Eliminar cualquier `style={{ background: '#ffffff' }}` o `bg-white` no deseado

```typescript
// ❌ Problemático
<div style={{ background: '#ffffff' }}>
  {content}
</div>

// ✅ Correcto
<div className="bg-tms-dark">
  {content}
</div>
```

#### 3. **Texto invisible o poco visible**
**Síntoma**: Texto que no se ve bien sobre fondo oscuro
**Causa**: Colores de texto inadecuados
**Solución**: Usar texto blanco para contenido principal y grises para secundario

```typescript
// ✅ Patrón correcto
<h1 className="text-white">Título Principal</h1>
<p className="text-gray-400">Texto secundario</p>
<span className="text-tms-green">Texto destacado</span>
```

---

## Guía de Mantenimiento

### Checklist para Nuevos Componentes

#### ✅ **Cards y Contenedores**
- [ ] Card usa `glass-card` class
- [ ] Fondo transparente sobre negro: `rgba(30, 41, 59, 0.8)`
- [ ] Bordes verdes sutiles: `border border-tms-green/20`
- [ ] Texto blanco principal: `text-white`

#### ✅ **Botones y Interactivos**
- [ ] Texto negro sobre verde: `bg-tms-green text-black`
- [ ] Hover usa verde: `hover:bg-tms-green hover:text-black`
- [ ] Estados ghost mantienen contraste adecuado
- [ ] Focus ring verde: `focus:ring-tms-green`

#### ✅ **Navegación**
- [ ] Links usan clase `.nav-link`
- [ ] Estados activos: `bg-tms-green text-black`
- [ ] Hover: `hover:bg-tms-green/10 hover:text-tms-green`
- [ ] Iconos mantienen consistencia visual

#### ✅ **Dropdowns y Overlays**
- [ ] Fondo oscuro: `bg-tms-dark` o `rgba(15, 23, 42, 0.95)`
- [ ] Alto z-index: `z-50`
- [ ] Bordes sutiles: `border-gray-700`
- [ ] Texto blanco: `text-white`

### Reglas de Oro

#### 1. **Siempre Fondo Negro**
Todos los componentes principales deben tener fondo negro:
```typescript
className="bg-tms-dark" // Negro profundo
```

#### 2. **Siempre Texto Blanco Principal**
Todo texto principal debe ser blanco para máximo contraste:
```typescript
className="text-white" // Texto principal
className="text-gray-400" // Texto secundario
```

#### 3. **Verde Brillante como Acento**
Usar `#9cfa24` para:
- Estados activos en navegación
- Botones principales
- Iconos de acción
- Elementos destacados

#### 4. **Glass Effects Sutiles**
```css
background: rgba(30, 41, 59, 0.8);
backdrop-filter: blur(10px);
border: 1px solid rgba(156, 250, 36, 0.2);
```

---

## Modificaciones Futuras

### Cómo Modificar el Color Principal

Si necesitas cambiar el verde brillante (`#9cfa24`):

#### 1. **Cambiar en todas las ubicaciones**
- `tailwind.config.ts` línea 39: `green: '#nuevo-color'`
- `index.css` línea 16: `--primary: R G B`
- `index.css` línea 23: `--tms-green: R G B`
- `useTheme.ts` línea 22: `--primary', '#nuevo-color'`

#### 2. **Verificar todos los componentes**
Buscar y verificar todas las referencias a:
- `text-tms-green`
- `bg-tms-green`
- `border-tms-green`
- `#9cfa24`

### Versionado del Sistema Visual

El archivo `index.css` incluye un comentario de versión:
```css
/* TMS Design System - Grúas Management - DARK THEME */
.tms-version-dark-restored {
  display: none;
}
```

Al hacer cambios mayores, actualizar el comentario para tracking.

---

## Conclusión

Este sistema visual garantiza:
- **Elegancia**: Tema oscuro moderno con efectos glass sutiles
- **Consistencia**: Todos los componentes siguen las mismas reglas visuales
- **Accesibilidad**: Alto contraste entre texto blanco y fondo negro
- **Branding**: Color verde brillante como identidad visual
- **Mantenibilidad**: Código organizado y bien documentado

El sistema está diseñado para ser robusto y fácil de mantener, con estilos específicos que aseguran que el tema oscuro elegante se mantenga consistente en toda la aplicación.
