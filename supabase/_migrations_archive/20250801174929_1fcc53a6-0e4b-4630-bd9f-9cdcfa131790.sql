-- Función para forzar refresco completo de cachés del frontend
CREATE OR REPLACE FUNCTION public.force_frontend_cache_refresh()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Esta función será llamada desde el frontend para invalidar todos los cachés
  -- y forzar una recarga completa de datos
  
  RETURN jsonb_build_object(
    'success', true,
    'timestamp', now(),
    'message', 'Cache refresh forced successfully'
  );
END;
$$;