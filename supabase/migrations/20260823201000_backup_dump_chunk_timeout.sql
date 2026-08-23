-- El bloque grande del respaldo no cabe en el límite de sentencia de PostgREST.
--
-- El rol de PostgREST corta a los 8 s. Medido: la tabla `recovery_audit_entries`
-- (jsonb pesado, ~20 MB) tarda ~25 s en serializarse, y no se puede partir sin
-- romper los marcadores `-- ===== tabla =====` / `-- N filas` que usa el
-- simulacro de restauración para recortar secciones.
--
-- La función se concede su propio límite. Aplica solo mientras dura su
-- ejecución y solo a ella, porque es SECURITY DEFINER.

ALTER FUNCTION public.backup_dump_chunk(text, int, int) SET statement_timeout = '90s';
