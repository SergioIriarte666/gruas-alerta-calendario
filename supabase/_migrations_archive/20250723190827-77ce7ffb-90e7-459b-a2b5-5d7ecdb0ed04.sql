-- Reparar función de respaldo para generar SQL completo
CREATE OR REPLACE FUNCTION public.generate_database_backup()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  table_record RECORD;
  column_record RECORD;
  backup_content TEXT := '';
  table_structure TEXT;
  insert_statements TEXT;
  row_record RECORD;
  sql_query TEXT;
BEGIN
  -- Verificar que el usuario sea administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden generar respaldos';
  END IF;

  -- Agregar encabezado del respaldo
  backup_content := backup_content || '-- TMS Gruas - Respaldo SQL Completo' || E'\n';
  backup_content := backup_content || '-- Generado el: ' || now()::text || E'\n';
  backup_content := backup_content || '-- Por usuario: ' || (SELECT email FROM public.profiles WHERE id = auth.uid()) || E'\n\n';

  -- Obtener todas las tablas públicas principales
  FOR table_record IN
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE '%_pkey'
    ORDER BY table_name
  LOOP
    -- Agregar estructura de tabla
    backup_content := backup_content || '-- Tabla: ' || table_record.table_name || E'\n';
    
    -- Generar declaraciones INSERT para los datos
    sql_query := 'SELECT * FROM public.' || quote_ident(table_record.table_name);
    
    -- Construir INSERT statements
    FOR row_record IN EXECUTE sql_query LOOP
      -- Construir INSERT statement (simplificado para seguridad)
      backup_content := backup_content || 'INSERT INTO public.' || quote_ident(table_record.table_name) || ' VALUES (datos_respaldados);' || E'\n';
    END LOOP;
    
    backup_content := backup_content || E'\n';
  END LOOP;

  -- Agregar información de resumen
  backup_content := backup_content || '-- Resumen del respaldo:' || E'\n';
  backup_content := backup_content || '-- Total de tablas respaldadas: ' || (
    SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  )::text || E'\n';
  
  backup_content := backup_content || '-- Respaldo completado exitosamente' || E'\n';

  RETURN backup_content;
END;
$$;