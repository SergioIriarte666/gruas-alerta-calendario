-- ¿La red de relanzamiento está puesta? Que lo diga la base, no un cable USB.
--
-- Primer arranque de la app con la ronda 4 (29/07, build 6): `app_boot_log` se
-- pobló correctamente, pero para saber si el plugin nativo de relanzamiento
-- estaba presente hubo que leer el log de Xcode y notar una AUSENCIA —que
-- `OperatorRelaunch getLaunchInfo` nunca cruzaba el puente—. Eso no escala: el
-- teléfono que importa está a 500 km y no se conecta a un Mac.
--
-- Tres estados, y los tres significan cosas distintas:
--   · true  → SLC armado: si el sistema mata el proceso, iOS relanza la app.
--   · false → el plugin responde pero no está armado (sin transmisión activa,
--             o sin permiso de ubicación "Siempre", que es el requisito real).
--   · NULL  → no se pudo preguntar: el plugin nativo NO está en este binario.
--             Es el caso que costó una tarde de diagnóstico.

BEGIN;

ALTER TABLE public.app_boot_log
  ADD COLUMN IF NOT EXISTS relaunch_armed boolean;

COMMENT ON COLUMN public.app_boot_log.relaunch_armed IS
  'Vigilancia de cambios significativos de ubicación al arrancar. true = armada; false = plugin presente pero sin armar (sin transmisión o sin permiso "Siempre"); NULL = el plugin nativo no está en este binario.';

COMMIT;
