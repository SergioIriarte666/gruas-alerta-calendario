## Diagnóstico

### 1. "Línea negra al final del modal Editar Operador"
En `src/components/operators/OperatorForm.tsx` (líneas 272-278) hay un indicador `fixed bottom-4 right-4 z-50` con fondo `bg-gray-800/90` y texto "Guardado automático activo". Esa píldora oscura es lo que se ve al pie del modal en el screenshot, solapando el botón "Actualizar Operador". No es parte del modal, está fijada a la ventana, y aparece SIEMPRE (también fuera del modal).

### 2. "Jorge Iriarte no se guarda en servicios"
Jorge Iriarte tiene `commission_exempt = true` (visible en el screenshot, switch violeta encendido en "Exento de comisiones"). El selector de operadores en `MultipleOperatorsSection.tsx` solo filtra por `op.isActive` — no filtra por exento, así que aparece y se puede seleccionar. Pero al guardar el servicio, el flujo en `useServiceManager.ts` (líneas 293-297, 348-364) inserta `operator_commission` y luego registros en `service_resources` con `commission_amount`. Cuando el servicio pasa a estado completado, los triggers de comisiones intentan crear un registro en `costs` y el trigger de defensa `prevent_excluded_operator_commissions` lanza una excepción que aborta la transacción y deja al usuario sin un mensaje claro de por qué no se guardó.

Causa raíz: el formulario de servicios no diferencia entre operadores que reciben comisión y operadores exentos. Para los exentos hay que forzar `commission = 0` y mostrar visualmente que es "Exento".

## Cambios propuestos

### A. `src/components/operators/OperatorForm.tsx`
- Eliminar el bloque "Auto-save indicator" fijo (líneas 272-278). Eliminar también el `import { Save }` si ya no se usa en otros lugares (sigue usándose en el `Alert`, así que se mantiene).
- Reemplazar el `border-t border` del footer (línea 255, clase mal escrita) por `border-t border-border` para coherencia con el design system violeta.

### B. `src/components/services/form/MultipleOperatorsSection.tsx`
- Cuando el operador seleccionado tenga `commissionExempt = true`:
  1. Mostrar un badge violeta junto a su nombre en el `SelectItem` y en el bloque ya seleccionado: `Exento`.
  2. Forzar `commission = 0` automáticamente al seleccionarlo (en `updateOperator` cuando el campo es `operatorId`, mirar `availableOperators` y si `commissionExempt` setear `commission: 0`).
  3. Deshabilitar el input de "Comisión (CLP)" para ese operador y mostrar texto auxiliar: "Operador exento de comisiones".
  4. Quitar el asterisco de obligatoriedad de la comisión cuando el operador es exento.
- Mantener filtro `op.isActive` para no mostrar inactivos.

### C. `src/hooks/services/useServiceManager.ts`
- Antes de los `insert` (creación) y `update` de servicios, normalizar comisiones: para cada operador en `serviceData.operators`, si el operador tiene `commission_exempt = true` en BD, forzar `commission = 0` antes de persistir (defensa en profundidad por si el form se salta el guard).
  - Hacer un `select id, commission_exempt from operators where id in (...)` previo a la inserción y mapear.
- Igualmente normalizar `operator_commission` en el `transformedData` del `service` principal cuando el operador principal sea exento.
- Capturar específicamente el error del trigger `prevent_excluded_operator_commissions` y mostrar un toast claro: "El operador X está marcado como exento de comisiones. La comisión se ajustó a $0".

### D. `src/components/services/EnhancedServiceForm.tsx`
- En la sección de "Operador y Comisión" principal (campo único, no múltiple), aplicar la misma lógica visual: si el operador elegido es exento, deshabilitar input de comisión, forzar 0 y mostrar etiqueta "Exento".

## Verificación post-cambio
- Editar un operador → no se ve píldora oscura debajo del botón.
- Crear/editar un servicio asignando a Jorge Iriarte → comisión queda en $0 automáticamente, badge "Exento" visible, servicio se guarda sin errores.
- Crear/editar un servicio asignando a un operador NO exento → comportamiento de comisiones intacto.
- Completar un servicio con operador exento → no se genera registro en `costs` (comportamiento ya garantizado por trigger `generate_commission_on_service_completion`), no hay error.

## Notas
- No se modifica el esquema de BD ni los triggers existentes (la regla escalable de `commission_exempt` se mantiene como fuente de verdad).
- Se respeta el design system violeta (badges, switches y estados ya alineados con el módulo de Costos).
