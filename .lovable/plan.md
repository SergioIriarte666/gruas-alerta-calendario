# Persistir Persona en el Lugar y Teléfono en servicios

## Problema

Los campos **Persona en el Lugar** (`contactPerson`) y **Teléfono Persona en el Lugar** (`contactPhone`) se capturan en el formulario y se muestran en el modal de detalles, pero **nunca se envían a la base de datos** al crear o editar un servicio. Por eso desaparecen al editar y no llegan a las notificaciones de WhatsApp del operador (`send-whatsapp-operator` los espera como `contactPerson` / `contactPhone`).

La tabla `services` ya tiene las columnas `contact_person` y `contact_phone` (migración `20260529120000_add_contact_person_to_services.sql`), y el tipo `ServiceFormData` ya las define. El único punto roto es el mapeo camelCase → snake_case en el manager de servicios.

## Cambios

Archivo único: `src/hooks/services/useServiceManager.ts`

1. **createServiceMutation** (bloque `transformedData` ~líneas 234–326): añadir
   ```
   contact_person: serviceData.contactPerson || null,
   contact_phone: serviceData.contactPhone || null,
   ```
   junto a `insured_name`.

2. **updateServiceMutation**, rama de actualización completa (~líneas 561–746): añadir los spreads condicionales siguiendo el patrón existente:
   ```
   ...(serviceData.contactPerson !== undefined && {
     contact_person: serviceData.contactPerson || null,
   }),
   ...(serviceData.contactPhone !== undefined && {
     contact_phone: serviceData.contactPhone || null,
   }),
   ```

No se toca lógica de negocio, validaciones, ni la rama de actualización parcial (esa sólo maneja folio/OC/cotización/status).

## Verificación

- Editar un servicio existente, rellenar Persona en el Lugar y Teléfono, guardar y reabrir: los valores deben persistir y mostrarse en el modal de detalles.
- Asignar un operador a ese servicio: el WhatsApp `servicio_asignado_v3` debe llegar con los placeholders `{{9}}` y `{{10}}` poblados con esos datos (en vez de caer al nombre/teléfono del cliente).
