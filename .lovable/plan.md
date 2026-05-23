## Problema detectado

Existen **dos páginas distintas** para respaldos, creando confusión:

1. **`/backup`** (sidebar "Respaldos") → módulo antiguo `BackupManager.tsx` con:
   - Card "Respaldo SQL Completo" cuya descripción dice *"de todas las tablas relacionadas con comisiones"* (texto heredado de cuando la herramienta sólo servía para reparar comisiones — en realidad respalda **toda** la base, no sólo comisiones).
   - Card "Sistema de Comisiones" con botones **Auditar / Reparar** (herramienta de emergencia, no un respaldo).

2. **`/settings` → Gestión de Respaldos** → módulo nuevo y completo (`BackupManagementSection`) con: estado, generación manual (SQL/JSON, completo/rápido), historial y la nueva sección **Envío Automático por Correo**.

El módulo nuevo es superior en todos los aspectos (más opciones, mejor UI alineada al diseño Costos, envío automático). El antiguo sólo aporta los botones de *Auditar/Reparar comisiones*, que pertenecen al panel de emergencia de administración, no al módulo de respaldos.

## Plan: unificar en un solo módulo

### 1. Convertir `/backup` en un alias de Settings
- Reemplazar el contenido de `src/pages/BackupPage.tsx` por una página delgada que **redirige a `/settings`** y abre directamente la sección de Respaldos (anchor `#respaldos`).
- Mantener la ruta para que enlaces o accesos directos existentes sigan funcionando.
- Mantener el item "Respaldos" del sidebar pero apuntando a `/settings#respaldos` (o dejarlo en `/backup` con redirect — efecto idéntico).

### 2. Mover Auditoría/Reparación de Comisiones a su lugar correcto
- Extraer las cards "Sistema de Comisiones (Auditar / Reparar)" del `BackupManager.tsx` y trasladarlas al **`AdminEmergencyPanel`** en Settings → Herramientas de Administración, donde ya conviven utilidades de reparación (Anular compra, eliminar servicios, etc.).
- Eliminar el componente `BackupManager.tsx` una vez migrado (queda obsoleto).

### 3. Anclaje y navegación
- Añadir `id="respaldos"` al contenedor de `BackupManagementSection` para que `/settings#respaldos` haga scroll automático.
- Pequeño `useEffect` en Settings que detecte el hash y haga scroll suave.

### 4. Corregir copy engañoso (sólo si se conserva)
- Si por alguna razón decides conservar `/backup`, cambiar la descripción a *"Respaldo completo de la base de datos del sistema"* — pero con el plan anterior esto ya no aplica porque el componente se elimina.

## Resultado para el usuario

- **Una sola pantalla** para todo lo relacionado con respaldos: `Configuración → Gestión de Respaldos`.
- Los botones de *Auditar / Reparar comisiones* aparecen donde pertenecen: **panel de emergencia de admin**.
- El enlace lateral "Respaldos" sigue funcionando y lleva directamente a la sección correcta.
- Desaparece el texto confuso sobre "tablas relacionadas con comisiones".

## Detalles técnicos

- Archivos modificados: `src/pages/BackupPage.tsx` (reemplazo por redirect), `src/components/admin/AdminEmergencyPanel.tsx` (añadir cards de Auditar/Reparar), `src/components/settings/BackupManagementSection.tsx` (añadir anchor id), `src/pages/Settings.tsx` (scroll-on-hash).
- Archivos eliminados: `src/components/backup/BackupManager.tsx`.
- Sin cambios en base de datos ni en Edge Functions.

## Pregunta antes de implementar

¿Prefieres que el item del sidebar **"Respaldos"** se elimine completamente (todo se gestiona desde Settings), o que se mantenga como atajo directo a la sección dentro de Settings? Mi recomendación es **mantenerlo como atajo** para no romper el hábito del usuario.
