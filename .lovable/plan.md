## Objetivo

Reemplazar en el PRD (y en el repositorio) toda mención hardcoded a los nombres "Jorge Iriarte / Sergio Iriarte / Jorge Ignacio Iriarte" como exclusión de comisiones, por la regla actual y escalable: **flag `commission_exempt` en la tabla `operators`**. Suprimir además la memoria obsoleta que aún describe la regla por nombres y dejar una sola fuente de verdad.

## Contexto verificado

- Memoria obsoleta: `mem://business-rules/commission-exclusion-enforcement-v2` describe aún la exclusión por nombres hardcoded.
- Memoria vigente (índice Core, línea 6): *"Commission exemptions managed via `commission_exempt` flag on operators table (not hardcoded names)"*.
- Ocurrencias a corregir en `PRD.md`:
  - Línea 203 (flujo "Comisión de operador").
  - Línea 356 (módulo `commissions` → "Exclusiones forzadas").
  - Línea 392 (regla crítica #3).

## Cambios concretos

### 1. `PRD.md` — actualizar 3 pasajes

- **L203** → Cambiar el paréntesis final por:
  *"Operadores con `commission_exempt = true` quedan excluidos del cálculo (configurable en su ficha)."*

- **L356** (módulo commissions) → Reemplazar "Exclusiones forzadas: …nombres…" por:
  *"**Exclusiones configurables:** operadores marcados con `commission_exempt = true` en su ficha. Trigger DB (`prevent_excluded_operator_commissions`) impide insertar comisiones para operadores exentos. Sin nombres hardcoded — totalmente escalable."*

- **L392** (regla crítica #3) → Reemplazar por:
  *"**Exclusión de comisiones configurable.** Operadores con `commission_exempt = true` no generan comisiones. La regla es por flag en `operators`, no por nombre — para que sea escalable a nuevos socios/exentos sin tocar código."*

### 2. Memoria — eliminar/reescribir la entrada obsoleta

- Reescribir `mem://business-rules/commission-exclusion-enforcement-v2` para que documente la **regla actual por flag** (qué tabla, qué trigger, cómo se administra desde la ficha del operador), eliminando los nombres propios.
- Actualizar la descripción correspondiente en `mem://index.md` (ya dice "DB-driven commission_exempt flag…", se mantiene; solo verificar consistencia).

### 3. Repositorio — barrido de menciones residuales

- Buscar otras menciones documentales (`docs/sistema-comisiones-restaurado.md`, `docs/changelog/*`, `CHANGELOG.md`, `docs/modules/commissions.md` si existe) que aún mencionen los nombres como regla activa, y reemplazarlas por la regla por flag. Si solo aparecen como nota histórica de migración, se conservan con un encabezado claro de "histórico".
- **No se tocan** las migraciones SQL antiguas (`supabase/migrations/*.sql`) porque son historial inmutable de cambios ya aplicados; modificarlas rompería la integridad del historial. Se deja constancia en el PRD que esas migraciones son históricas.

## Fuera de alcance

- No se cambia código de la app ni triggers de base de datos (la regla por flag ya está implementada).
- No se modifican migraciones SQL existentes.

## Entregable

- `PRD.md` actualizado (3 pasajes).
- `mem://business-rules/commission-exclusion-enforcement-v2` reescrita.
- Documentos en `docs/` con menciones obsoletas actualizadas.
