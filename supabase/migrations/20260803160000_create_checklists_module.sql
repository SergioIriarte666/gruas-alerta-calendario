-- FASE 1 del módulo de Checklists de seguridad (portal operador).
-- Solo esquema + seed. Sin UI, sin PDF, sin correo: esas son fases posteriores.
--
-- Dos documentos distintos comparten el mismo motor:
--   * fatiga_somnolencia      -> encuesta al conductor, respuestas si/no/na
--   * preoperacional_grua_cama-> checklist del camión, respuestas bueno/malo/na
--
-- Decisiones de negocio confirmadas por el dueño y grabadas aquí para que no se
-- reinterpreten más adelante:
--   * El pre-operacional es UNO por grúa por día, pero NO todas las grúas salen
--     todos los días: no se autogenera nada ni se alerta por ausencia.
--   * El de fatiga tiene frecuencia variable (ligada a servicios mineros), así que
--     NO lleva restricción de unicidad.
--   * Ambos son OPCIONALES en esta etapa: no bloquean ningún flujo.
--   * La vinculación a servicio es MIXTA: service_id nullable, asignable o
--     desasignable después de firmado.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Catálogo: plantillas
-- ---------------------------------------------------------------------------
-- PK de texto siguiendo el precedente de inspection_equipment_items: el id es un
-- identificador estable que el código referencia por nombre.
CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  subtitle    text,
  version     integer NOT NULL DEFAULT 1,
  answer_type text NOT NULL CHECK (answer_type IN ('si_no_na', 'bueno_malo_na')),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.checklist_templates IS
  'Plantillas de checklists de seguridad. El id es estable y lo referencia el código.';
COMMENT ON COLUMN public.checklist_templates.version IS
  'Se incrementa al editar la plantilla. Los checklists llenados guardan la versión con la que se firmaron.';

-- ---------------------------------------------------------------------------
-- 2. Catálogo: secciones
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checklist_template_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id text NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  title       text NOT NULL,
  sort_order  integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT checklist_template_sections_order_unique UNIQUE (template_id, sort_order)
);

-- ---------------------------------------------------------------------------
-- 3. Catálogo: ítems
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checklist_template_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  uuid NOT NULL REFERENCES public.checklist_template_sections(id) ON DELETE CASCADE,
  label       text NOT NULL,
  sort_order  integer NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  risk_answer text CHECK (risk_answer IN ('si', 'no')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT checklist_template_items_order_unique UNIQUE (section_id, sort_order)
);

COMMENT ON COLUMN public.checklist_template_items.risk_answer IS
  'METADATO PURO en esta fase: marca cuál respuesta indica condición de riesgo. '
  'No lo consume ninguna lógica todavía; existe para que las alertas futuras no '
  'necesiten otra migración. NULL = el riesgo no se expresa por respuesta puntual.';

CREATE INDEX IF NOT EXISTS idx_checklist_template_sections_template
  ON public.checklist_template_sections (template_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_checklist_template_items_section
  ON public.checklist_template_items (section_id, sort_order);

-- ---------------------------------------------------------------------------
-- 4. Documentos llenados
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checklists (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id      text NOT NULL REFERENCES public.checklist_templates(id),
  template_version integer NOT NULL,
  items_snapshot   jsonb NOT NULL,
  operator_id      uuid NOT NULL REFERENCES public.operators(id),
  crane_id         uuid REFERENCES public.cranes(id),
  service_id       uuid REFERENCES public.services(id) ON DELETE SET NULL,
  performed_at     timestamptz NOT NULL,
  performed_date   date NOT NULL,
  header           jsonb NOT NULL DEFAULT '{}'::jsonb,
  answers          jsonb NOT NULL DEFAULT '{}'::jsonb,
  observations     text,
  is_safe_to_operate boolean,
  operator_signature text,
  reviewer_name      text,
  reviewer_signature text,
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'signed', 'sent', 'void')),
  pdf_url          text,
  pdf_uploaded_at  timestamptz,
  email_sent_at    timestamptz,
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.checklists.items_snapshot IS
  'Copia de secciones+ítems al momento de llenar. CRÍTICO: si mañana se edita la '
  'plantilla, los documentos ya firmados deben seguir renderizando exactamente lo '
  'que se firmó. El PDF y la vista de detalle leen de aquí, nunca del catálogo.';
COMMENT ON COLUMN public.checklists.performed_date IS
  'Día de negocio del checklist, lo llena la app con businessClock. NO es columna '
  'generada a propósito: AT TIME ZONE no es IMMUTABLE y Postgres rechaza '
  'GENERATED ALWAYS AS sobre performed_at.';
COMMENT ON COLUMN public.checklists.service_id IS
  'Vinculación MIXTA: opcional, asignable o desasignable después. ON DELETE SET NULL '
  'para que borrar un servicio no se lleve un documento de seguridad ya firmado.';
COMMENT ON COLUMN public.checklists.is_safe_to_operate IS
  'Solo aplica al pre-operacional. NULL en el checklist de fatiga.';

-- ---------------------------------------------------------------------------
-- 5. Índices
-- ---------------------------------------------------------------------------
-- Uno por grúa por día para el pre-operacional. Deliberadamente NO aplica a
-- fatiga_somnolencia: frecuencia variable por decisión del dueño. Excluye
-- borradores y anulados para que un borrador abandonado no bloquee la jornada.
CREATE UNIQUE INDEX IF NOT EXISTS ux_checklists_preop_crane_day
  ON public.checklists (crane_id, performed_date)
  WHERE template_id = 'preoperacional_grua_cama'
    AND crane_id IS NOT NULL
    AND deleted_at IS NULL
    AND status NOT IN ('draft', 'void');

CREATE INDEX IF NOT EXISTS idx_checklists_operator_date
  ON public.checklists (operator_id, performed_date DESC);
CREATE INDEX IF NOT EXISTS idx_checklists_service
  ON public.checklists (service_id);
CREATE INDEX IF NOT EXISTS idx_checklists_status
  ON public.checklists (status);

-- ---------------------------------------------------------------------------
-- 6. updated_at
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS handle_updated_at_checklist_templates ON public.checklist_templates;
CREATE TRIGGER handle_updated_at_checklist_templates
  BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS handle_updated_at_checklist_template_sections ON public.checklist_template_sections;
CREATE TRIGGER handle_updated_at_checklist_template_sections
  BEFORE UPDATE ON public.checklist_template_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS handle_updated_at_checklist_template_items ON public.checklist_template_items;
CREATE TRIGGER handle_updated_at_checklist_template_items
  BEFORE UPDATE ON public.checklist_template_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS handle_updated_at_checklists ON public.checklists;
CREATE TRIGGER handle_updated_at_checklists
  BEFORE UPDATE ON public.checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------
-- Se replica el patrón ya vigente en inspections: helpers SECURITY DEFINER
-- is_admin_user_safe() / is_operator_user_safe() / get_current_user_role_safe(),
-- envueltos en (SELECT ...) para que el planner los evalúe una vez por consulta
-- (mismo criterio de 20260627200000_fix_performance_warnings).
--
-- Diferencia respecto de inspections: allí el operador se resuelve por asignación
-- al servicio (is_operator_assigned_to_service). Aquí NO sirve, porque service_id
-- es nullable por diseño; la pertenencia se resuelve por operators.user_id.
--
-- Se usa una política por acción (en vez de FOR ALL) para no dejar dos políticas
-- permisivas solapadas sobre SELECT, que es lo que marca el advisor de performance.

ALTER TABLE public.checklist_templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template_sections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists                   ENABLE ROW LEVEL SECURITY;

-- Catálogo: lectura para cualquier autenticado, escritura solo admin.
DROP POLICY IF EXISTS checklist_templates_select ON public.checklist_templates;
CREATE POLICY checklist_templates_select ON public.checklist_templates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS checklist_templates_admin_insert ON public.checklist_templates;
CREATE POLICY checklist_templates_admin_insert ON public.checklist_templates
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin_user_safe()));

DROP POLICY IF EXISTS checklist_templates_admin_update ON public.checklist_templates;
CREATE POLICY checklist_templates_admin_update ON public.checklist_templates
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin_user_safe()))
  WITH CHECK ((SELECT public.is_admin_user_safe()));

DROP POLICY IF EXISTS checklist_templates_admin_delete ON public.checklist_templates;
CREATE POLICY checklist_templates_admin_delete ON public.checklist_templates
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin_user_safe()));

DROP POLICY IF EXISTS checklist_template_sections_select ON public.checklist_template_sections;
CREATE POLICY checklist_template_sections_select ON public.checklist_template_sections
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS checklist_template_sections_admin_insert ON public.checklist_template_sections;
CREATE POLICY checklist_template_sections_admin_insert ON public.checklist_template_sections
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin_user_safe()));

DROP POLICY IF EXISTS checklist_template_sections_admin_update ON public.checklist_template_sections;
CREATE POLICY checklist_template_sections_admin_update ON public.checklist_template_sections
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin_user_safe()))
  WITH CHECK ((SELECT public.is_admin_user_safe()));

DROP POLICY IF EXISTS checklist_template_sections_admin_delete ON public.checklist_template_sections;
CREATE POLICY checklist_template_sections_admin_delete ON public.checklist_template_sections
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin_user_safe()));

DROP POLICY IF EXISTS checklist_template_items_select ON public.checklist_template_items;
CREATE POLICY checklist_template_items_select ON public.checklist_template_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS checklist_template_items_admin_insert ON public.checklist_template_items;
CREATE POLICY checklist_template_items_admin_insert ON public.checklist_template_items
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin_user_safe()));

DROP POLICY IF EXISTS checklist_template_items_admin_update ON public.checklist_template_items;
CREATE POLICY checklist_template_items_admin_update ON public.checklist_template_items
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin_user_safe()))
  WITH CHECK ((SELECT public.is_admin_user_safe()));

DROP POLICY IF EXISTS checklist_template_items_admin_delete ON public.checklist_template_items;
CREATE POLICY checklist_template_items_admin_delete ON public.checklist_template_items
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin_user_safe()));

-- Documentos: admin todo, operador solo los suyos, viewer solo lectura.
DROP POLICY IF EXISTS checklists_select ON public.checklists;
CREATE POLICY checklists_select ON public.checklists
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_user_safe())
    OR (SELECT public.get_current_user_role_safe()) = 'viewer'::public.app_role
    OR (
      (SELECT public.is_operator_user_safe())
      AND EXISTS (
        SELECT 1 FROM public.operators o
        WHERE o.id = checklists.operator_id
          AND o.user_id = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS checklists_insert ON public.checklists;
CREATE POLICY checklists_insert ON public.checklists
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin_user_safe())
    OR (
      (SELECT public.is_operator_user_safe())
      AND EXISTS (
        SELECT 1 FROM public.operators o
        WHERE o.id = checklists.operator_id
          AND o.user_id = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS checklists_update ON public.checklists;
CREATE POLICY checklists_update ON public.checklists
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_admin_user_safe())
    OR (
      (SELECT public.is_operator_user_safe())
      AND EXISTS (
        SELECT 1 FROM public.operators o
        WHERE o.id = checklists.operator_id
          AND o.user_id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    (SELECT public.is_admin_user_safe())
    OR (
      (SELECT public.is_operator_user_safe())
      AND EXISTS (
        SELECT 1 FROM public.operators o
        WHERE o.id = checklists.operator_id
          AND o.user_id = (SELECT auth.uid())
      )
    )
  );

-- El borrado duro queda solo en manos de admin; el operador anula con
-- deleted_at / status = 'void' a través de la política de UPDATE.
DROP POLICY IF EXISTS checklists_admin_delete ON public.checklists;
CREATE POLICY checklists_admin_delete ON public.checklists
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin_user_safe()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_templates         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_template_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_template_items    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklists                  TO authenticated;
GRANT ALL ON public.checklist_templates         TO service_role;
GRANT ALL ON public.checklist_template_sections TO service_role;
GRANT ALL ON public.checklist_template_items    TO service_role;
GRANT ALL ON public.checklists                  TO service_role;

-- ---------------------------------------------------------------------------
-- 8. Bucket privado checklist-pdfs
-- ---------------------------------------------------------------------------
-- Bucket propio a propósito: NO se reutiliza inspection-pdfs porque los crones de
-- archivado a R2 y de purga apuntan a inspecciones y mezclar los objetos rompería
-- esa lógica de retención.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('checklist-pdfs', 'checklist-pdfs', false, 20971520, '{application/pdf}'::text[])
ON CONFLICT (id) DO NOTHING;

-- Políticas equivalentes a las vigentes de inspection-pdfs (operador o admin).
DROP POLICY IF EXISTS checklist_pdfs_upload ON storage.objects;
CREATE POLICY checklist_pdfs_upload
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'checklist-pdfs'
  AND ((SELECT public.is_operator_user_safe()) OR (SELECT public.is_admin_user_safe()))
);

DROP POLICY IF EXISTS checklist_pdfs_read ON storage.objects;
CREATE POLICY checklist_pdfs_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'checklist-pdfs'
  AND ((SELECT public.is_operator_user_safe()) OR (SELECT public.is_admin_user_safe()))
);

-- UPDATE presente desde el día uno: sin ella un upload con upsert:true rebota con
-- "new row violates row-level security policy" (mismo bug que 20260713230000).
DROP POLICY IF EXISTS checklist_pdfs_update ON storage.objects;
CREATE POLICY checklist_pdfs_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'checklist-pdfs'
  AND ((SELECT public.is_operator_user_safe()) OR (SELECT public.is_admin_user_safe()))
)
WITH CHECK (
  bucket_id = 'checklist-pdfs'
  AND ((SELECT public.is_operator_user_safe()) OR (SELECT public.is_admin_user_safe()))
);

DROP POLICY IF EXISTS checklist_pdfs_delete ON storage.objects;
CREATE POLICY checklist_pdfs_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'checklist-pdfs'
  AND ((SELECT public.is_operator_user_safe()) OR (SELECT public.is_admin_user_safe()))
);

-- ---------------------------------------------------------------------------
-- 9. Seed idempotente
-- ---------------------------------------------------------------------------
INSERT INTO public.checklist_templates (id, name, subtitle, version, answer_type, is_active)
VALUES
  ('fatiga_somnolencia',
   'Lista de Chequeo de Fatiga y Somnolencia a Conductores y Operadores',
   NULL, 1, 'si_no_na', true),
  ('preoperacional_grua_cama',
   'Checklist Pre-Operacional: Camión Grúa Cama (Chile)',
   NULL, 1, 'bueno_malo_na', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.checklist_template_sections (template_id, title, sort_order)
VALUES
  ('fatiga_somnolencia',       'Encuesta al conductor', 1),
  ('preoperacional_grua_cama', 'DOCUMENTACIÓN DEL VEHÍCULO', 1),
  ('preoperacional_grua_cama', 'EQUIPAMIENTO MINERO, COMUNICACIÓN Y LUCES AUXILIARES', 2),
  ('preoperacional_grua_cama', 'KIT DE CONDUCCIÓN INVERNAL (ALTA CORDILLERA / NIEVE)', 3),
  ('preoperacional_grua_cama', 'ESTADO DEL VEHÍCULO Y CABINA', 4),
  ('preoperacional_grua_cama', 'SISTEMA HIDRÁULICO, PLATAFORMA Y ARRASTRE (WINCHE)', 5),
  ('preoperacional_grua_cama', 'ELEMENTOS DE SEGURIDAD Y EMERGENCIA', 6)
ON CONFLICT (template_id, sort_order) DO NOTHING;

-- Los ítems se cuelgan de la sección resolviendo (template_id, section_order), que
-- es la llave natural de la sección; así el seed no depende de uuids generados.
--
-- NOTA: el formulario original en papel dice "2do. Neumatico Respuesto" (dos
-- errores ortográficos). El seed va corregido a "2do. Neumático de Repuesto" a
-- propósito.
INSERT INTO public.checklist_template_items (section_id, label, sort_order, risk_answer)
SELECT s.id, v.label, v.sort_order, v.risk_answer
FROM (VALUES
  -- fatiga_somnolencia / Encuesta al conductor
  ('fatiga_somnolencia'::text, 1, 1,
   '¿Tiene usted algunos síntomas de fatiga y/o somnolencia por ejemplo sueño, cansancio, dolor de cabeza, enrojecimiento de los ojos, falta de concentración, etc.?'::text,
   'si'::text),
  ('fatiga_somnolencia', 1, 2,
   '¿Usted se encuentra tomando algún medicamento, diagnosticado o no, que ocasione efectos colaterales por ejemplo inducción al sueño, cansancio, falta de concentración, reacciones lentas, que pudieran impedir una conducción u operación segura?',
   'si'),
  ('fatiga_somnolencia', 1, 3,
   '¿Considera usted que durmió / descansó adecuadamente y se encuentra en buenas condiciones, física y mental antes de conducir u operar un equipo?',
   'no'),
  ('fatiga_somnolencia', 1, 4,
   '¿Cree usted que necesita, en este momento, descansar para poder realizar una conducción (Vehículo) u operación (Equipo) más segura?',
   'si'),
  ('fatiga_somnolencia', 1, 5,
   'En caso de conducir, ¿Tiene conocimiento previo de la ruta o camino? ¿Conoce la zona de curvas peligrosas, pendientes, zona de encandilamiento, cruce de animales, etc.?',
   'no'),
  ('fatiga_somnolencia', 1, 6,
   'En caso de transitar por rutas o caminos internos, ¿Sabe cuáles son las áreas o km desde donde reportarse a garita de control vía radial?',
   'no'),

  -- preoperacional_grua_cama / 1. DOCUMENTACIÓN DEL VEHÍCULO
  -- risk_answer NULL en todo el pre-operacional: el riesgo lo expresa 'malo', es uniforme.
  ('preoperacional_grua_cama', 1, 1, 'Permiso de Circulación al día', NULL),
  ('preoperacional_grua_cama', 1, 2, 'Revisión Técnica y de Gases vigente', NULL),
  ('preoperacional_grua_cama', 1, 3, 'Seguro Obligatorio (SOAP) vigente', NULL),
  ('preoperacional_grua_cama', 1, 4, 'Licencia de Conducir (Clase A4 o A5)', NULL),

  -- 2. EQUIPAMIENTO MINERO, COMUNICACIÓN Y LUCES AUXILIARES
  ('preoperacional_grua_cama', 2, 1, 'Radio de comunicación (VHF/UHF, canales de faena)', NULL),
  ('preoperacional_grua_cama', 2, 2, 'Luces auxiliares frontales (Focos faeneros / neblineros)', NULL),
  ('preoperacional_grua_cama', 2, 3, 'Luces auxiliares traseras (Focos de faena para la cama)', NULL),
  ('preoperacional_grua_cama', 2, 4, 'Pértiga e iluminación de pértiga (si aplica)', NULL),
  ('preoperacional_grua_cama', 2, 5, 'Baliza estroboscópica operacional', NULL),

  -- 3. KIT DE CONDUCCIÓN INVERNAL (ALTA CORDILLERA / NIEVE)
  ('preoperacional_grua_cama', 3, 1, 'Caja de invierno (Cadenas para nieve del tamaño correcto)', NULL),
  ('preoperacional_grua_cama', 3, 2, 'Tensores para cadenas y candados de repuesto', NULL),
  ('preoperacional_grua_cama', 3, 3, 'Líquido anticongelante en el radiador (Nivel y estado)', NULL),
  ('preoperacional_grua_cama', 3, 4, 'Pala para nieve', NULL),
  ('preoperacional_grua_cama', 3, 5, '2do. Neumático de Repuesto', NULL),

  -- 4. ESTADO DEL VEHÍCULO Y CABINA
  ('preoperacional_grua_cama', 4, 1, 'Niveles de fluidos (Aceite, Agua, Líquido de Frenos)', NULL),
  ('preoperacional_grua_cama', 4, 2, 'Neumáticos (Presión, dibujo, pernos de ruedas)', NULL),
  ('preoperacional_grua_cama', 4, 3, 'Luces estándar (Altas, bajas, posición, viraje, freno)', NULL),
  ('preoperacional_grua_cama', 4, 4, 'Alarma de retroceso sonora', NULL),
  ('preoperacional_grua_cama', 4, 5, 'Espejos retrovisores y parabrisas (Sin trizaduras)', NULL),
  ('preoperacional_grua_cama', 4, 6, 'Frenos de servicio y freno de mano (Estacionamiento)', NULL),

  -- 5. SISTEMA HIDRÁULICO, PLATAFORMA Y ARRASTRE (WINCHE)
  ('preoperacional_grua_cama', 5, 1, 'Toma de fuerza (PTO) y comandos de operación', NULL),
  ('preoperacional_grua_cama', 5, 2, 'Cilindros hidráulicos (Sin fugas de aceite)', NULL),
  ('preoperacional_grua_cama', 5, 3, 'Mangueras y conexiones hidráulicas', NULL),
  ('preoperacional_grua_cama', 5, 4, 'Estado de la cama (Estructura, soldaduras, piso)', NULL),
  ('preoperacional_grua_cama', 5, 5, 'Cable de acero del winche (Sin deshilachados)', NULL),
  ('preoperacional_grua_cama', 5, 6, 'Gancho de izaje y lengüeta de seguridad', NULL),
  ('preoperacional_grua_cama', 5, 7, 'Eslingas, cadenas y ratchets', NULL),

  -- 6. ELEMENTOS DE SEGURIDAD Y EMERGENCIA
  ('preoperacional_grua_cama', 6, 1, 'Extintor de incendios (PQS, carga vigente)', NULL),
  ('preoperacional_grua_cama', 6, 2, 'Triángulos de señalización o conos', NULL),
  ('preoperacional_grua_cama', 6, 3, 'Chaleco de alta visibilidad', NULL),
  ('preoperacional_grua_cama', 6, 4, 'Botiquín de primeros auxilios completo', NULL),
  ('preoperacional_grua_cama', 6, 5, 'Cuñas para ruedas (Mínimo 2 de poliuretano/goma)', NULL)
) AS v(template_id, section_order, sort_order, label, risk_answer)
JOIN public.checklist_template_sections s
  ON s.template_id = v.template_id
 AND s.sort_order  = v.section_order
ON CONFLICT (section_id, sort_order) DO NOTHING;

COMMIT;
