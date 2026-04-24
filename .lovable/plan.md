
# Plan: Refactor del sistema visual — de parches a sistema unificado

## Diagnóstico (verificado en código)

El tema actual NO está roto, pero es **frágil**: cada cambio de color obliga a tocar 5–10 lugares. Las causas son acumulativas:

### 1. Tokens contradictorios entre sí
- `src/index.css` define `--primary: 84 100% 58%` (**verde lima `#9cfa24`**).
- `tailwind.config.ts` expone además `tms.green`, `sidebar.principal`, `slate.*` con valores duplicados.
- La memoria del proyecto (`design-system-standards`, `responsive-design-standards`) dice "alto contraste centrado en **violeta**".
- El usuario tiene preferencia de accesibilidad: **evitar verde** (memoria `accessibility-color-preference-v2`).
- → Hoy conviven **dos paletas** (verde TMS heredado + violeta nuevo), por eso "cambiar el tema" se siente caótico.

### 2. Doce "scopes" CSS por módulo (parches)
En `src/index.css` existen estos bloques con **64 `!important`**:
```
client-scope, services-scope, calendar-scope, vip-pipeline-scope,
cranes-scope, operators-scope, closures-scope, suppliers-scope,
reports-scope, service-types-scope, settings-scope, clients-scope
```
Cada uno **deshace** clases hardcodeadas (`text-white`, `bg-black`, `bg-gray-700`, `border-gray-700`) que quedaron de cuando la app era oscura. Es código defensivo: si se cambia un color del token, los scopes lo "ganan" con `!important` y nada se actualiza.

### 3. Botón con estilos inline + handlers JS
`src/components/ui/button.tsx` aplica `style={{ backgroundColor: '#9cfa24', color: '#000' }}` y maneja hover con `onMouseEnter/Leave` en JS. **Esto sobreescribe cualquier token** y es invisible para Tailwind/Theming. Cambiar el verde implica editar este archivo, no un token.

### 4. Theme hook bloqueado
`src/hooks/useTheme.ts` fuerza `'light'` ignorando la configuración del usuario. El selector "Tema" en `UserSettingsTab` existe pero no hace nada → falsa promesa de modo oscuro.

### 5. `App.css` legacy
Estilos del template Vite original (`#root { max-width: 1280px; padding: 2rem; text-align: center }`) que no se aplican al layout real pero generan ruido y pueden romper páginas no envueltas en `Layout`.

### 6. Sin escala tipográfica ni de espaciado documentada
Cada componente decide tamaños (`text-[10px]`, `text-xs`, `text-sm`, `text-2xl`) sin tokens semánticos (`text-metric`, `text-section-title`). El "Cost Module" — que es el patrón a seguir según el project-knowledge — no está formalizado como tokens reutilizables.

---

## Propuesta de mejora

### Fase 1 — Unificar la paleta (decisión de fondo)
Antes de tocar código necesito que confirmes la dirección de marca. El plan se adapta a tu elección, pero el resto de fases es el mismo.

> Te haré la pregunta al inicio de la implementación. Opciones:
> - **A) Violeta** (`271 81% 56%` ≈ `#8b5cf6`) — coherente con tu accesibilidad y con la mayoría de memorias recientes. Recomendado.
> - **B) Verde lima actual** (`#9cfa24`) — mantener marca histórica TMS.
> - **C) Otra** — me dices el HEX.

Lo elegido se vuelve **`--primary` única** y se eliminan `tms.green*` y `sidebar.principal` del config para que no exista una segunda fuente.

### Fase 2 — Tokens semánticos completos
Reescribir `:root` en `src/index.css` con un set mínimo y semántico:
```
--primary, --primary-foreground, --primary-hover
--surface, --surface-elevated, --surface-sunken    (reemplaza card/popover/secondary)
--text-strong, --text, --text-muted, --text-subtle
--border, --border-strong, --ring
--success, --warning, --danger, --info  (+ -foreground y -soft de cada uno)
--radius-sm/md/lg, --shadow-sm/md/lg
```
Los tokens viejos (`--card`, `--muted`, etc.) se mantienen como **alias** para no romper Radix/shadcn, pero apuntan a los nuevos.

Añadir tokens de **estado de pago** (memoria `payment-status-visual-standard`) y de **departamentos** ya existentes, expuestos como clases utilitarias (`.badge-paid`, `.badge-pending`, `.badge-overdue`).

### Fase 3 — Reescribir el Button (sin estilos inline)
Eliminar `style={{}}` y `onMouseEnter/Leave` de `src/components/ui/button.tsx`. Las variantes vuelven a depender 100% de `cva` + clases Tailwind con tokens (`bg-primary text-primary-foreground hover:bg-primary/90`). Resultado: cambiar `--primary` actualiza **todos los botones** sin tocar TS.

### Fase 4 — Eliminar los 12 `-scope` y limpiar clases hardcodeadas
1. Buscar y reemplazar en cada módulo las clases legacy de tema oscuro:
   - `text-white` → `text-foreground`
   - `text-gray-300/400/500` → `text-muted-foreground`
   - `bg-black`, `bg-gray-700/800` → `bg-card` / `bg-muted`
   - `border-gray-600/700/800` → `border-border`
2. Eliminar los wrappers `<div className="services-scope">…</div>` en cada página.
3. Borrar los bloques `*-scope` de `index.css` (≈ 250 líneas, los 64 `!important` desaparecen).
4. Verificar visualmente módulo por módulo (Servicios, Grúas, Operadores, Clientes, Calendario, Suppliers, Reports, Settings, VIP, Closures, Service Types).

### Fase 5 — Componentes primitivos del "Cost Module" como estándar
Extraer las piezas que el project-knowledge marca como referencia y promoverlas a `src/components/ui/`:
- `<PageHeader>` (título + métricas + acciones, como `CostsHeader`).
- `<MetricCard>` (unifica `ReportMetricCard`, `MetricCard`, `PendingCategoryCard`).
- `<DataToolbar>` (búsqueda + filtros rápidos + view-mode toggle).
- `<StatusBadge variant="paid|pending|overdue|...">` (reemplaza badges sueltos).
- `<SectionCard>` (Card con header tipográfico estandarizado).

Cada uno consume **solo tokens semánticos**. Migrar primero Costos (ya cumple), luego Inventario, Servicios, Grúas, etc.

### Fase 6 — Theme hook honesto
Dos opciones; decido en implementación según tu respuesta a Fase 1:
- **Si no quieres modo oscuro**: ocultar el selector "Tema" en `UserSettingsTab` y borrar `useTheme.ts`.
- **Si lo quieres**: implementar dark real añadiendo bloque `.dark { ... }` en `index.css` con los mismos tokens semánticos invertidos. Dado el volumen actual, esto se entrega como Fase 6 opcional **después** de Fases 1–5.

### Fase 7 — Limpieza final
- Borrar `src/App.css` (legacy del template).
- Documentar tokens y primitivas en `docs/design-system.md` (1 página: paleta, tipografía, espaciado, badges, ejemplo de uso).
- Crear memoria `mem://design/tokens-v3` con la paleta final como **única fuente de verdad** y marcar las memorias antiguas conflictivas como obsoletas.

---

## Orden de entrega y riesgo

| Fase | Riesgo | Reversible | Visual user-facing |
|------|--------|------------|--------------------|
| 1. Decisión paleta | — | sí | no |
| 2. Tokens semánticos + alias | bajo | sí | mínimo (mismo look) |
| 3. Button sin inline | bajo | sí | sí, hover más limpio |
| 4. Eliminar `-scope` (módulo a módulo) | medio | sí, módulo por módulo | sí |
| 5. Primitivas UI | bajo | sí | consistencia visual |
| 6. Modo oscuro real (opcional) | medio | sí | nuevo feature |
| 7. Limpieza + docs | nulo | — | no |

**Lo funcional NO se toca**: ninguna lógica de negocio, ninguna tabla, ningún hook de datos. Solo CSS, clases y un componente (`button.tsx`).

## Resultado esperado
- Cambiar el color de marca = editar **una línea** (`--primary`) y todo se actualiza.
- 0 `!important`, 0 wrappers `*-scope`, 0 estilos inline en primitivas.
- Un solo lenguaje visual heredado del módulo de Costos.
- Base limpia para introducir, si quieres, modo oscuro real más adelante sin parches.
