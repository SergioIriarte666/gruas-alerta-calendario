
# Plan: PRD v3.1 — Capa ejecutiva, aceptación, riesgos y dependencias

Se actualiza `PRD.md` (de v3.0 a v3.1) atacando los seis vacíos detectados, sin perder el detalle técnico actual (se reorganiza, no se elimina). El documento sigue siendo fuente única de verdad, pero gana una capa ejecutiva al inicio y secciones formales de gobernanza al final.

## Cambios estructurales en `PRD.md`

### 1. Nueva sección "0. Resumen ejecutivo para stakeholders no técnicos"
Insertada antes del actual §1. Una página, sin jerga:
- Qué es TMS Grúas en 3 párrafos.
- Quiénes lo usan y para qué (matriz rol → beneficio).
- Estado actual y madurez (semáforo verde/ámbar/rojo por área: Operaciones, Finanzas, Inventario, Móvil/PWA, Integraciones).
- Próximos 3 hitos priorizados con impacto esperado.
- Link explícito al resto del documento para perfiles técnicos.

### 2. Reescritura del §17 Roadmap con priorización Impacto × Esfuerzo
Reemplazar la lista plana actual por:
- **Tabla de priorización** con columnas: Iniciativa | Impacto (Alto/Medio/Bajo) | Esfuerzo (S/M/L) | Prioridad (P0/P1/P2) | Dependencias | Justificación.
- **Clasificación P0/P1/P2/P3:**
  - P0 (crítico, próximo): separación preview/prod en Supabase, WhatsApp Meta, hardening offline (conflictos).
  - P1 (alto valor): analítica predictiva, dashboards interactivos, multi-tenant prep.
  - P2 (mejoras): VIP matching, expansión reportes.
  - P3 (backlog explícito): ideas registradas pero no comprometidas.
- **Sección "No haremos (out of scope explícito)"** dentro del roadmap: app nativa iOS/Android, ERP completo, módulo de RRHH, integración SII directa de emisión, etc.

### 3. Nueva sección "5.bis Criterios de aceptación (Definition of Done) por módulo crítico"
Checklist formal para los 8 módulos más sensibles: Servicios, Facturas, Costos, Pagos/Conciliación, Inventario, Comisiones, Cuentas por Pagar, PWA Offline. Cada uno con:
- Criterios funcionales (qué debe hacer, verificable).
- Criterios de datos (integridad, RLS, auditoría).
- Criterios de UX (responsive, estados de carga/error/vacío, accesibilidad).
- Criterios de QA (casos felices, casos límite, regresiones a verificar).
- Criterios de rendimiento (umbral concreto cuando aplique).

Formato compacto tipo checklist, no prosa.

### 4. Nueva sección "19. Supuestos, restricciones y out-of-scope global"
- **Supuestos operativos:** conectividad intermitente esperada en terreno, equipo administrativo pequeño, volumen máximo asumido (servicios/mes, items inventario, usuarios concurrentes).
- **Restricciones técnicas:** stack Lovable/React/Vite, Supabase como backend único, sin servidor propio, idioma es-CL.
- **Out of scope global:** lista de funcionalidades fuera del producto y razón.

### 5. Nueva sección "20. Riesgos y mitigaciones"
Tabla: Riesgo | Probabilidad | Impacto | Estado | Mitigación | Owner. Incluye explícitamente los riesgos detectados:
- **R1 — Preview y producción comparten Supabase.** Alto impacto. Mitigación propuesta: proyecto Supabase separado para preview o, en su defecto, política estricta de "no mutaciones destructivas en preview", sufijo de datos de prueba, snapshot diario antes de pruebas.
- **R2 — Offline/PWA y conflictos de sincronización.** Definir en §11 política de resolución de conflictos (last-write-wins por campo vs merge), límites declarados (qué no se soporta offline: importadores XML, OCR, generación PDF compleja), tamaño máximo de cola, expiración.
- **R3 — Envejecimiento del PRD.** Política de mantenimiento: revisión obligatoria por release menor, owner asignado, cambelog del propio PRD (ya existe en Apéndice E, se formaliza).
- **R4 — Concentración de conocimiento.** Mitigación: enlace cruzado obligatorio PRD ↔ `docs/modules/` ↔ `mem://`, evitar duplicar especificaciones detalladas (el PRD referencia, no duplica).
- **R5 — Dependencias externas (OpenAI, Mapbox, GetAPI, Resend, Meta).** Plan de degradación por proveedor.

### 6. Nueva sección "21. Matriz de dependencias críticas"
Tabla módulo × dependencia con marcas (●/○):

```text
Módulo              | RLS | Edge Fn | Storage | OCR/IA | Offline | Mapbox | GetAPI | Resend | SII XML
Servicios           |  ●  |    ○    |    ●    |   ○    |   ●     |   ○    |   ○    |   ○    |   ○
Facturas            |  ●  |    ●    |    ○    |   ○    |   ○     |   ○    |   ○    |   ●    |   ●
Costos              |  ●  |    ●    |    ○    |   ●    |   ●     |   ○    |   ○    |   ○    |   ●
Inventario          |  ●  |    ○    |    ○    |   ○    |   ●     |   ○    |   ○    |   ○    |   ●
Inspecciones        |  ●  |    ●    |    ●    |   ○    |   ●     |   ○    |   ○    |   ●    |   ○
Trip Calculator     |  ●  |    ●    |    ○    |   ○    |   ○     |   ●    |   ●    |   ○    |   ○
Quick Entry OCR     |  ●  |    ●    |    ●    |   ●    |   ○     |   ○    |   ○    |   ○    |   ○
Reportes            |  ●  |    ●    |    ○    |   ○    |   ○     |   ○    |   ○    |   ●    |   ○
Comisiones          |  ●  |    ○    |    ○    |   ○    |   ○     |   ○    |   ○    |   ○    |   ○
Backup              |  ●  |    ●    |    ●    |   ○    |   ○     |   ○    |   ○    |   ●    |   ○
```

Acompañada de una breve sección "Plan de degradación por dependencia" (qué hace el sistema si OpenAI/Mapbox/GetAPI/Resend caen).

### 7. Refuerzo de §11 Capacidad offline (no nueva sección, expansión)
Añadir subsecciones explícitas:
- **Soportado offline:** lista cerrada por módulo.
- **NO soportado offline:** importadores XML, OCR, envío de emails, generación de PDFs server-side, integraciones externas.
- **Resolución de conflictos:** estrategia (last-write-wins a nivel de fila con timestamp del cliente vs servidor; campos calculados siempre del servidor).
- **Límites:** tamaño máximo de cola IndexedDB, TTL de operaciones pendientes, política cuando se excede.

### 8. Refuerzo de §15 Despliegue (no nueva, expansión breve)
Añadir nota destacada del riesgo R1 y la mitigación recomendada (link a §20).

## Cambios menores

- Versión del documento: 3.0 → 3.1; actualizar fecha y entrada en Apéndice E con resumen de cambios.
- Actualizar Tabla de contenidos con las nuevas secciones (0, 5.bis, 19, 20, 21).
- Asegurar que el detalle técnico ya existente (§5–§13) se mantiene intacto — no se elimina, solo se complementa.

## Archivos a modificar

- `PRD.md` — única edición. No se tocan `docs/`, memorias ni código.

## Lo que NO hace este plan

- No reescribe la especificación por módulo (§5).
- No cambia reglas de negocio (§6) ni el modelo de datos.
- No genera documentos derivados (resumen ejecutivo separado, deck, etc.) — si se quiere uno aparte, se hace en una iteración posterior.
