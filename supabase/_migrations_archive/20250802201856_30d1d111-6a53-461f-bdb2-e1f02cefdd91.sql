-- Función para disparar evento global de refresh desde la base de datos
CREATE OR REPLACE FUNCTION public.trigger_global_data_refresh()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Esta función se puede llamar desde el frontend para disparar eventos de refresh
  -- No hace nada en la BD, solo sirve como trigger para el frontend
  RAISE NOTICE 'Disparando evento global de refresh de datos...';
  
  -- Log para auditoría
  RAISE NOTICE 'Global data refresh triggered at %', now();
END;
$function$;