
# Diagnóstico React Doctor

**Score actual: 42/100 (Critical)** — 5.047 issues en 644/979 archivos.

```text
Categoría          Errores  Advertencias  Total
─────────────────────────────────────────────────
Architecture          10        ~3407     3417
Performance            0         ~631      631
State & Effects       17         ~551      568
Correctness           25         ~215      240
Accessibility          6         ~132      138
```

## Hallazgos críticos (errores reales que rompen comportamiento)

1. **Componentes anidados (×25)** — `SortButton` definido dentro de `CommissionTable`, etc. Cada render crea una instancia nueva, destruyendo estado interno y rompiendo memoización. Archivos: `CommissionTable.tsx`, otros 24.
2. **Efectos sin cleanup (×14)** — `useEffect` con `subscribe(...)` sin `return unsubscribe`. Fugas de listeners/timers. Archivos: `HistoricalSales.tsx:65` y otros 13.
3. **Mutables en deps (×3)** — `location.pathname`, `ref.current` en arrays de dependencias (no disparan re-render). Archivos: `Costs.tsx:95` y 2 más.
4. **Fast refresh roto (×10)** — Archivos que exportan componentes + no-componentes (constantes, hooks). Rompe HMR.
5. **ARIA combobox sin `aria-controls` (×6)** — `SupplierSelector.tsx:88` y otros 5.

## Hallazgos masivos (warnings de mayor impacto)

- **Tailwind `w-N h-N` → `size-N` (×2740)** — codemod trivial, mejora ~50 puntos potenciales.
- **`space-x/y-*` en flex/grid (×258)** — reemplazar por `gap-*` (RTL-safe, sin phantom-gaps).
- **Side-effects en `useEffect` que deberían ser handlers (×149)** — antipatrón documentado en react.dev.
- **Array index como `key` (×81)** — bugs al reordenar/filtrar.
- **`exhaustive-deps` (×63)** — refs capturadas en cleanup.
- **`.map().filter()` doble iteración (×101)** — consolidar a un solo pase.
- **`await` en `for…of` (×91)** — paralelizar con `Promise.all` donde sean independientes.
- **Labels sin `htmlFor` (×66)** y **onClick sin onKey* (×19)** — accesibilidad.

---

## Plan de remediación (por fases, máximo impacto primero)

### Fase 1 — Codemods masivos seguros (suben el score ~20-30 puntos)
- Ejecutar reemplazo automatizado `w-N h-N` (mismo N) → `size-N` en todo `src/`. Solo strings de className, regex acotada.
- Reemplazar `space-x-N` / `space-y-N` por `gap-x-N` / `gap-y-N` en padres flex/grid (revisar caso a caso si el padre realmente es flex/grid; si no, mantener).
- Verificación: build + revisión visual en módulos críticos (Costos, Servicios, Facturas).

### Fase 2 — Bugs correctness (errores reales)
- Extraer los 25 componentes anidados a scope de módulo o archivos separados (empezando por `CommissionTable`).
- Añadir cleanup a los 14 `useEffect` con suscripciones/timers sin liberar.
- Mover `location.pathname` / `ref.current` desde deps al cuerpo del efecto en `Costs.tsx`, `Invoices.tsx`, `PortalServices.tsx`.
- Convertir los efectos que son "event handlers disfrazados" (priorizar los 20 con más renders).

### Fase 3 — Fast refresh + a11y
- Separar exports no-componente de los 10 archivos detectados (mover constantes/hooks a `*.utils.ts` o `*.hooks.ts`).
- Añadir `aria-controls` a los 6 comboboxes Radix custom.
- Asociar labels (`htmlFor`) en los 66 formularios señalados.

### Fase 4 — Performance focalizada
- Reescribir `.map().filter()` repetidos en tablas grandes (Closures, Reports, Commissions) a un solo pase.
- Paralelizar `await` en loops donde las operaciones sean independientes (auditando uno por uno — algunos son secuenciales intencionalmente, ej. sync de pagos).
- Reemplazar `key={index}` por id estable en las 81 listas señaladas (priorizar las que permiten reorden/filtro: `EnhancedServicesSelector`, tablas paginadas).

### Fase 5 — Dead code (opcional, omitido en este scan)
- Reactivar `--dead-code` en una corrida posterior para detectar archivos/exports/dependencias sin uso y ciclos de imports.

---

## Detalles técnicos

- Reporte JSON completo guardado en sandbox: `/tmp/react-doctor-d148d7de-...`
- Comando usado: `npx react-doctor@latest -y --no-dead-code`
- URL de resultados compartibles: https://www.react.doctor/share?p=vite_react_shadcn_ts&s=42&e=58&w=4989&f=644
- Recomendado en CI: añadir GitHub Action con `--fail-on error` para no permitir regresiones de los 58 errores actuales.

---

## ¿Cómo quieres avanzar?

Cada fase es independiente. Sugiero ejecutar **Fase 1 primero** (codemods Tailwind) porque es bajo riesgo y elimina ~3000 warnings de una sola pasada, dejando visibles los problemas reales. Luego Fase 2 (bugs). ¿Apruebas comenzar por Fase 1, o prefieres priorizar Fase 2 (correctness) primero?
