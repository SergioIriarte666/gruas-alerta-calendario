## Problema detectado

Al escribir en Origen/Destino del modal de servicios, el desplegable casi nunca muestra coincidencias históricas — aparece "Presiona Enter para usar esta ubicación" incluso cuando existen registros previos con ese texto (ej. "Santiago Miraflores").

Tras revisar `useFrequentLocations.ts` y `LocationCombobox.tsx`, hay 4 causas reales:

1. **`searchLocations` busca sólo en el Top 10 ya truncado.** Cualquier ubicación que no esté entre las 10 más usadas es invisible al escribir, aunque exista en el historial. Esto explica por qué "Santiago Miraflores" no aparece: probablemente está en el histórico pero no es top-10.
2. **Agrupación sensible a mayúsculas/acentos.** "Salfa Freire", "salfa freire" y "SALFA FREIRE" se cuentan como ubicaciones distintas, fragmentando frecuencias y empujando entradas reales fuera del Top 10.
3. **Doble filtrado con `cmdk`.** El `Command` de shadcn aplica su propio filtro fuzzy sobre `CommandItem value`, encima del filtro nuestro → items legítimos pueden desaparecer. Falta `shouldFilter={false}`.
4. **"Presiona Enter" no hace nada.** El `CommandInput` no tiene handler de Enter; el usuario pulsa Enter y no pasa nada (el valor ya estaba seteado por `onValueChange` al escribir, pero el popover no se cierra y no hay feedback).

## Cambios

### `src/hooks/services/useFrequentLocations.ts`
- Construir un **índice completo** de ubicaciones (sin truncar a 10) usando una clave normalizada (`trim` + `toLowerCase` + `normalize('NFD')` sin diacríticos) para agrupar variantes; preservar la primera forma legible vista como `displayLocation`.
- Exportar dos cosas separadas:
  - `frequentOrigins` / `frequentDestinations`: Top 10 para mostrar al abrir vacío.
  - `searchLocations(query, type)`: recorrer el **índice completo** (no el top 10), filtrar por la clave normalizada con `includes`, ordenar por `count` desc, devolver hasta 15 resultados.
- `query` también se normaliza antes de comparar (resuelve "miraflores" vs "Miraflores" y "frutillar" vs "Frútillar").

### `src/components/services/form/LocationCombobox.tsx`
- Pasar `shouldFilter={false}` al `<Command>` para que cmdk respete nuestro filtrado.
- Tras `searchLocations`, si el `inputValue` no coincide exactamente con ninguna sugerencia, añadir una fila sintética "Usar '<texto>'" al final que al seleccionarla cierra el popover con el valor tal cual escrito (reemplaza el mensaje muerto de "Presiona Enter").
- Manejar `onKeyDown` en `CommandInput`: si el usuario pulsa Enter y no hay item resaltado, commit el `inputValue` actual y cerrar el popover.
- Cuando el usuario abre el combobox y el campo ya tiene valor (modo edición), no resetear `inputValue` ni perder el contexto.

## Fuera de alcance
- No tocar el esquema de servicios ni la persistencia (las ubicaciones se siguen guardando como texto libre en `services.origin/destination`).
- No agregar tabla dedicada de ubicaciones — el histórico se sigue derivando en memoria de `useServices`.
- No cambiar el diseño visual (mantiene tokens, tipografía y patrón actual).
