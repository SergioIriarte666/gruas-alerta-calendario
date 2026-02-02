
# Plan: Corrección de Vista Móvil - Clientes y Pipeline VIP

## Problemas Identificados

### 1. ClientsMobileView - Colores de Tema Oscuro en Tema Claro

**Archivo:** `src/components/clients/ClientsMobileView.tsx`

**Problema Principal:** El componente usa clases de tema oscuro que son invisibles en el tema claro actual:

| Línea | Clase Actual | Problema |
|-------|--------------|----------|
| 46, 63, 80, 88 | `text-white` | Texto blanco invisible sobre fondo blanco |
| 45, 48, 90, 91 | `text-gray-400`, `text-gray-500` | Bajo contraste |
| 46, 63 | `glass-card` | Funciona pero cards internas no contrastan |
| 151, 177 | `text-purple-400`, `text-tms-green` | Colores muy claros para tema claro |

**Esto explica la captura donde NO se ve el nombre del cliente** - el texto es blanco sobre fondo blanco.

---

### 2. VipClientPipeline - Header No Responsive

**Archivo:** `src/pages/VipClientPipeline.tsx`

**Problema:** El header (líneas 186-222) no tiene ajustes móviles:
- `flex items-center justify-between` no envuelve en móvil
- El nombre del cliente y badge "VIP Pipeline" no se ven cuando se corta
- Los tabs usan `grid-cols-4` sin variante móvil

---

## Cambios a Implementar

### Archivo 1: `src/components/clients/ClientsMobileView.tsx`

Actualizar todas las clases de color para usar variables CSS del tema:

```tsx
// Antes (línea 80):
<h3 className="text-lg font-semibold text-white">Clientes ({totalClients})</h3>

// Después:
<h3 className="text-lg font-semibold text-foreground">Clientes ({totalClients})</h3>
```

**Cambios específicos:**

| Línea | Antes | Después |
|-------|-------|---------|
| 46 | `text-white` | `text-foreground` |
| 63 | `text-white` | `text-foreground` |
| 80 | `text-white` | `text-foreground` |
| 88 | `text-white` | `text-foreground` |
| 90 | `text-tms-green` | `text-primary` |
| 91 | `text-gray-500` | `text-muted-foreground` |
| 103-104 | `bg-tms-green text-black` / `bg-gray-600 text-white` | Usar clases semánticas |
| 114-137 | `text-white` en todos los campos | `text-foreground` |
| 115, 122, 129, 136 | `text-gray-400` en iconos | `text-muted-foreground` |
| 45, 64 | `text-gray-400` en empty states | `text-muted-foreground` |
| 48 | `text-gray-400` en párrafos | `text-muted-foreground` |

---

### Archivo 2: `src/pages/VipClientPipeline.tsx`

Hacer el header responsive para móvil:

```tsx
// Antes (línea 186):
<div className="flex items-center justify-between">

// Después:
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
```

**Cambios específicos:**

| Ubicación | Antes | Después |
|-----------|-------|---------|
| Línea 186 | `flex items-center justify-between` | `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4` |
| Línea 187 | `gap-4` interno | Agregar `flex-wrap` |
| Línea 198 | Título `text-2xl` | `text-xl sm:text-2xl` |
| Línea 229 | TabsList `grid-cols-4` | `grid-cols-2 sm:grid-cols-4` |

---

### Archivo 3: `src/index.css`

Agregar scope para clientes (siguiendo patrón existente):

```css
/* Clients Module Scope */
.clients-scope {
  color: hsl(var(--foreground));
}

.clients-scope .text-white {
  color: hsl(var(--foreground)) !important;
}

.clients-scope .text-gray-400 {
  color: hsl(var(--muted-foreground)) !important;
}

.clients-scope .text-gray-500 {
  color: hsl(var(--muted-foreground)) !important;
}
```

---

## Resumen de Archivos a Modificar

| # | Archivo | Tipo de Cambio |
|---|---------|----------------|
| 1 | `src/components/clients/ClientsMobileView.tsx` | Actualizar clases de color a variables semánticas |
| 2 | `src/pages/VipClientPipeline.tsx` | Hacer header y tabs responsivos |
| 3 | `src/index.css` | Agregar clients-scope como fallback |

---

## Resultado Esperado

Después de los cambios:

1. **Vista de Clientes Móvil**: El nombre del cliente será visible (texto oscuro sobre fondo claro)
2. **Pipeline VIP**: El header con nombre del cliente se verá correctamente y los tabs serán usables en 2 columnas en móvil
3. **Consistencia**: Los colores seguirán el sistema de diseño unificado del resto de la app
