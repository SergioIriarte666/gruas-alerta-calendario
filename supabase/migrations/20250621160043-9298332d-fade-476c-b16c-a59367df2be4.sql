
-- Crear función para generar respaldo completo de la base de datos
CREATE OR REPLACE FUNCTION public.generate_database_backup()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  backup_content TEXT := '';
  table_record RECORD;
  row_record RECORD;
  column_info RECORD;
  insert_statement TEXT;
  values_part TEXT;
  backup_metadata TEXT;
BEGIN
  -- Verificar que el usuario sea administrador
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden generar respaldos';
  END IF;

  -- Generar metadatos del respaldo
  backup_metadata := format(
    '-- TMS Grúas Database Backup
-- Generated on: %s
-- Generated by: %s
-- Database version: PostgreSQL %s
-- 
-- IMPORTANT: This backup contains all system data
-- Restore only on compatible TMS Grúas installations
--

SET client_encoding = ''UTF8'';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

',
    now(),
    (SELECT email FROM public.profiles WHERE id = auth.uid()),
    version()
  );

  backup_content := backup_metadata;

  -- Lista de tablas a respaldar (en orden de dependencias)
  FOR table_record IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%'
    ORDER BY 
      CASE table_name
        WHEN 'profiles' THEN 1
        WHEN 'cost_categories' THEN 2
        WHEN 'service_types' THEN 3
        WHEN 'clients' THEN 4
        WHEN 'cranes' THEN 5
        WHEN 'operators' THEN 6
        WHEN 'company_data' THEN 7
        WHEN 'system_settings' THEN 8
        WHEN 'services' THEN 9
        WHEN 'costs' THEN 10
        WHEN 'inspections' THEN 11
        WHEN 'service_closures' THEN 12
        WHEN 'closure_services' THEN 13
        WHEN 'invoices' THEN 14
        WHEN 'invoice_services' THEN 15
        WHEN 'invoice_closures' THEN 16
        WHEN 'calendar_events' THEN 17
        ELSE 99
      END
  LOOP
    backup_content := backup_content || format('
-- 
-- Data for table: %s
--

', table_record.table_name);

    -- Obtener información de columnas
    SELECT string_agg(column_name, ', ' ORDER BY ordinal_position) AS columns
    INTO column_info
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = table_record.table_name;

    -- Generar INSERT statements para cada fila
    FOR row_record IN EXECUTE format('SELECT * FROM public.%I', table_record.table_name)
    LOOP
      -- Construir la parte VALUES del INSERT
      SELECT string_agg(
        CASE 
          WHEN value IS NULL THEN 'NULL'
          WHEN value_type IN ('text', 'varchar', 'char', 'uuid', 'date', 'timestamp', 'time') THEN 
            quote_literal(value)
          WHEN value_type = 'boolean' THEN value
          WHEN value_type LIKE '%[]' THEN 
            CASE 
              WHEN value = '{}' THEN '''{}'''
              ELSE quote_literal(value)
            END
          ELSE value
        END, 
        ', '
      ) INTO values_part
      FROM (
        SELECT 
          CASE 
            WHEN column_name = 'id' THEN row_record.id::TEXT
            WHEN column_name = 'created_at' THEN row_record.created_at::TEXT
            WHEN column_name = 'updated_at' THEN row_record.updated_at::TEXT
            WHEN column_name = 'name' THEN row_record.name
            WHEN column_name = 'email' THEN row_record.email
            WHEN column_name = 'role' THEN row_record.role::TEXT
            WHEN column_name = 'full_name' THEN row_record.full_name
            WHEN column_name = 'is_active' THEN row_record.is_active::TEXT
            WHEN column_name = 'description' THEN row_record.description
            ELSE 
              CASE 
                WHEN EXISTS (
                  SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = table_record.table_name 
                  AND column_name = column_name
                ) THEN 'DEFAULT'
                ELSE 'NULL'
              END
          END AS value,
          data_type AS value_type,
          column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = table_record.table_name
        ORDER BY ordinal_position
      ) AS column_values;

      -- Construir el INSERT statement completo
      insert_statement := format(
        'INSERT INTO public.%I (%s) VALUES (%s);',
        table_record.table_name,
        column_info.columns,
        values_part
      );

      backup_content := backup_content || insert_statement || E'\n';
    END LOOP;
  END LOOP;

  -- Añadir footer del respaldo
  backup_content := backup_content || format('
--
-- Backup completed successfully
-- Total tables backed up: %s
-- Generated at: %s
--
',
    (SELECT count(*) FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'),
    now()
  );

  RETURN backup_content;
END;
$$;

-- Crear función simplificada para generar respaldo básico (más rápida)
CREATE OR REPLACE FUNCTION public.generate_quick_backup()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  backup_data JSONB := '{}';
  table_data JSONB;
BEGIN
  -- Verificar permisos
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden generar respaldos';
  END IF;

  -- Respaldo de configuración de empresa
  SELECT to_jsonb(row) INTO table_data
  FROM (SELECT * FROM public.company_data LIMIT 1) row;
  backup_data := jsonb_set(backup_data, '{company_data}', COALESCE(table_data, 'null'));

  -- Respaldo de configuración del sistema
  SELECT to_jsonb(row) INTO table_data
  FROM (SELECT * FROM public.system_settings LIMIT 1) row;
  backup_data := jsonb_set(backup_data, '{system_settings}', COALESCE(table_data, 'null'));

  -- Conteo de registros principales
  backup_data := jsonb_set(backup_data, '{metadata}', jsonb_build_object(
    'generated_at', now(),
    'generated_by', (SELECT email FROM public.profiles WHERE id = auth.uid()),
    'counts', jsonb_build_object(
      'clients', (SELECT count(*) FROM public.clients),
      'services', (SELECT count(*) FROM public.services),
      'operators', (SELECT count(*) FROM public.operators),
      'cranes', (SELECT count(*) FROM public.cranes),
      'invoices', (SELECT count(*) FROM public.invoices)
    )
  ));

  RETURN backup_data;
END;
$$;

-- Crear tabla para registro de respaldos
CREATE TABLE IF NOT EXISTS public.backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  backup_type TEXT NOT NULL CHECK (backup_type IN ('full', 'quick', 'auto')),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  file_size_bytes BIGINT,
  error_message TEXT,
  metadata JSONB
);

-- Habilitar RLS en la tabla de logs
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

-- Política para que solo admins vean logs de respaldos
CREATE POLICY "Only admins can view backup logs" ON public.backup_logs
  FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
