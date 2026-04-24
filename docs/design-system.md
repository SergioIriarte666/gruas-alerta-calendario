# Sistema de Diseño TMS — v3

Fuente única de verdad para color, tipografía, espaciado y componentes primitivos.

## Paleta

Color de marca: **violeta `#8b5cf6`** (HSL `271 81% 56%`).
Definida en `src/index.css :root` como `--primary`. **Cambiar esa línea actualiza toda la app.**

| Token              | Light                    | Dark                       | Uso                              |
|--------------------|--------------------------|----------------------------|----------------------------------|
| `--primary`        | `271 81% 56%` violeta    | `271 91% 65%` violeta claro| Botones primarios, badges marca  |
| `--background`     | blanco                   | `222 47% 8%`               | Fondo de la app                  |
| `--surface`        | blanco                   | `222 40% 11%`              | Tarjetas (alias de `--card`)     |
| `--text` (`--foreground`) | gris oscuro       | gris claro                 | Texto cuerpo                     |
| `--text-muted` (`--muted-foreground`) | gris medio | gris medio              | Texto secundario                 |
| `--border`         | gris muy claro           | gris oscuro                | Separadores                      |
| `--success`        | verde 36%                | verde 45%                  | Éxito (pagado, completado)       |
| `--warning`        | ámbar                    | ámbar luminoso             | Advertencia (pendiente)          |
| `--danger`         | rojo                     | rojo luminoso              | Error (vencido, eliminar)        |
| `--info`           | azul                     | azul luminoso              | Información                      |

Cada token de estado tiene también `-foreground` (texto sobre el color) y `-soft` (fondo suave para badges).

## Modo oscuro

Implementado en `.dark { ... }` en `index.css`. Mismos tokens semánticos, paleta invertida.
Gestionado por `ThemeProvider` (`src/contexts/ThemeContext.tsx`):

```tsx
const { theme, resolvedTheme, setTheme } = useTheme();
// theme: "light" | "dark" | "system" (preferencia del usuario)
// resolvedTheme: "light" | "dark" (efectivamente aplicado al DOM)
setTheme("dark"); // persiste en localStorage y en settings
```

El selector de tema vive en **Configuración → Preferencias de Usuario**.

## Tipografía

- **Familia**: Montserrat (sans-serif).
- Escala: usar utilidades Tailwind estándar (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`).
- **Títulos de página**: `text-2xl font-bold text-foreground tracking-tight` (ya encapsulado en `<PageHeader>`).
- **Títulos de sección**: `text-base font-semibold text-foreground` (ya encapsulado en `<SectionCard>`).
- **Métricas KPI**: `text-2xl font-bold` (ya encapsulado en `<MetricCard>`).

## Componentes primitivos (`src/components/ui/`)

### `<PageHeader>`
Encabezado estándar de página con título, descripción, badges y acciones.
```tsx
<PageHeader
  title="Gestión de Costos"
  description="Administra y registra todos los costos operativos"
  actions={<Button onClick={onAdd}>Nuevo Costo</Button>}
/>
```

### `<MetricCard>`
Tarjeta KPI con icono, valor y tendencia.
```tsx
<MetricCard
  title="Monto Total"
  value={formatCurrency(total)}
  icon={DollarSign}
  tone="success"
  trend={{ value: 12.5, direction: "up", isPositive: false }}
/>
```
Tonos: `primary | success | warning | danger | info | muted`.

### `<StatusBadge>`
Badge semántico para estados de negocio.
```tsx
<StatusBadge tone="paid" icon={CheckCircle}>Pagado</StatusBadge>
<StatusBadge tone="overdue">Vencido</StatusBadge>
```
Tonos: `paid | pending | overdue | in_progress | completed | cancelled | draft | info | neutral`.

### `<SectionCard>`
Tarjeta de sección con header tipográfico estandarizado.
```tsx
<SectionCard title="Detalles del Servicio" icon={Truck} actions={<Button>Editar</Button>}>
  ...
</SectionCard>
```

### `<Badge>`
Variantes con tokens semánticos completos: `default | secondary | destructive | outline | tms | success | warning | info`.

## Reglas críticas

1. **Nunca** usar colores Tailwind directos sobre superficies de marca:
   - ❌ `text-violet-600` sobre `bg-primary` (texto invisible — `--primary` ES violeta)
   - ❌ `text-white` sobre fondos neutros (no se ve en light mode)
   - ❌ `bg-gray-700`, `bg-black`, `border-gray-*` (no responden a tokens, rompen dark mode)
   - ✅ `text-primary-foreground` sobre `bg-primary`
   - ✅ `text-foreground` sobre `bg-background` / `bg-card`
   - ✅ `bg-muted`, `border-border`

2. **Nunca** estilos inline (`style={{ backgroundColor: '#...' }}`) en primitivas — sobreescriben tokens y rompen dark mode.

3. **Toda variante nueva** en `cva` (Button, Badge, etc.) DEBE incluir `bg-*` Y `text-*` explícitos. Los wrappers globales `*-scope` fueron eliminados; nadie rescata variantes vacías.

4. **Para acentos violetas decorativos** (no badges/botones): usar `text-primary` en lugar de `text-violet-600`. Así si la marca cambia, todo se actualiza automáticamente.

## Migración pendiente (no urgente)

~131 archivos aún usan `text-violet-*`/`bg-violet-*` directos como acento (heredado de cuando `--primary` era verde). En modo oscuro estos colores se ven igual de violeta porque ignoran los tokens. Migrarlos a `text-primary`/`bg-primary` cuando se toque cada módulo.