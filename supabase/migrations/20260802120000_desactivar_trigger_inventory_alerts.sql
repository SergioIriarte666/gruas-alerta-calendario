-- =====================================================================
-- Apagar el sistema viejo de alertas de inventario — 2026-08-02
-- =====================================================================
--
-- MOTIVO
--
-- `trigger_check_inventory_alerts` sobre `inventory_stock` insertaba en
-- `notification_logs` una fila POR CADA usuario admin u operador cada vez que un
-- producto quedaba en o bajo su mínimo. Como `inventory_items.minimum_stock` es
-- `integer DEFAULT 0`, la condición `NEW.current_quantity <= minimum_stock` se
-- cumplía con cualquier producto que llegara a cero: 942 filas acumuladas desde
-- julio 2025, 616 de ellas sólo en abril 2026.
--
-- Esas notificaciones no las ve nadie. `notification_logs` sólo se lee en la línea
-- de tiempo de Auditoría; no alimenta ninguna campana, panel ni bandeja. Es
-- escritura pura, a ciegas y en cascada por usuario.
--
-- El aviso de stock bajo pasa a mostrarse únicamente en pantalla, dentro de Bodega,
-- con el criterio corregido (agrupado por producto, sólo activos, sólo con mínimo
-- definido). No hay WhatsApp, correo ni panel de configuración: por eso también se
-- borran las 2 filas de configuración de `inventory_alerts`, que no tienen UI desde
-- que el commit 4a207cf8 (2025-10-17) sacó la pestaña "Alertas" de Bodega.
--
-- NO se toca `alert_acknowledgements`: esa tabla está viva, la usan los documentos
-- de grúas y de operadores.
--
-- Las tablas `inventory_alerts` e `inventory_stock` se conservan; acá sólo se apaga
-- el proceso que escribía en vano y se limpia lo que dejó.
-- =====================================================================

BEGIN;

-- 1. El trigger que escribía a ciegas.
DROP TRIGGER IF EXISTS trigger_check_inventory_alerts ON public.inventory_stock;

-- La función `public.check_inventory_alerts()` queda huérfana (era su único trigger,
-- verificado sobre pg_trigger). Se deja a propósito: apagar el proceso no exige
-- borrarla y así el cambio es reversible reponiendo sólo el CREATE TRIGGER. Si se
-- decide borrarla, va en una migración aparte.

-- 2. Las notificaciones que generó y que nadie leyó nunca (942 filas).
DELETE FROM public.notification_logs
WHERE type = 'inventory_alert';

-- 3. La configuración del sistema viejo, sin UI desde 2025-10-17 (2 filas).
DELETE FROM public.inventory_alerts;

COMMIT;
