-- Fase 5: administración del maestro de checklists desde Configuración.
--
-- Tres cosas que NO pueden quedar en manos del cliente:
--
-- 1. EL VERSIONADO. Si la app hiciera "mutar + subir version" como dos llamadas
--    sueltas, un fallo en la segunda dejaría la versión mintiendo sobre el
--    contenido. Se resuelve con un trigger a nivel de SENTENCIA: cualquier alta,
--    baja, renombre, reorden o cambio de answer_type sube la versión en la MISMA
--    transacción, y no hay forma de olvidarse.
--
-- 2. EL REORDEN. `checklist_template_items` tiene UNIQUE (section_id, sort_order)
--    —a diferencia de inspection_equipment_items, que no tiene ninguna— así que
--    el patrón de la pantalla de Inventario (N updates en paralelo asignando
--    1..N) choca a mitad de la reasignación. Se hacen las restricciones
--    DEFERRABLE y el reorden pasa a ser UNA sentencia con las llaves diferidas
--    al COMMIT.
--
-- 3. EL BORRADO DE PLANTILLAS. De los literales 'fatiga_somnolencia' y
--    'preoperacional_grua_cama' dependen el índice único parcial
--    ux_checklists_preop_crane_day y el branch de columnas del generador de PDF.
--    Un trigger lo impide en la base, no solo en la UI.
--
-- Borrar del maestro es borrado REAL, sin baja lógica: cada checklist guarda su
-- propio items_snapshot con el answer_type ya resuelto, así que ni los firmados
-- ni los borradores abiertos se ven afectados.

BEGIN;

-- ── 1) Versionado automático ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bump_checklist_template_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- A nivel de sentencia: un reorden de 7 ítems sube la versión UNA vez, no siete.
  IF TG_TABLE_NAME = 'checklist_template_sections' THEN
    UPDATE public.checklist_templates t
       SET version = t.version + 1, updated_at = now()
     WHERE t.id IN (SELECT DISTINCT a.template_id FROM affected a);
  ELSE
    UPDATE public.checklist_templates t
       SET version = t.version + 1, updated_at = now()
     WHERE t.id IN (
       SELECT DISTINCT s.template_id
       FROM public.checklist_template_sections s
       WHERE s.id IN (SELECT a.section_id FROM affected a)
     );
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_version_sections_ins ON public.checklist_template_sections;
CREATE TRIGGER trg_bump_version_sections_ins
  AFTER INSERT ON public.checklist_template_sections
  REFERENCING NEW TABLE AS affected
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_checklist_template_version();

DROP TRIGGER IF EXISTS trg_bump_version_sections_upd ON public.checklist_template_sections;
CREATE TRIGGER trg_bump_version_sections_upd
  AFTER UPDATE ON public.checklist_template_sections
  REFERENCING NEW TABLE AS affected
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_checklist_template_version();

DROP TRIGGER IF EXISTS trg_bump_version_sections_del ON public.checklist_template_sections;
CREATE TRIGGER trg_bump_version_sections_del
  AFTER DELETE ON public.checklist_template_sections
  REFERENCING OLD TABLE AS affected
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_checklist_template_version();

DROP TRIGGER IF EXISTS trg_bump_version_items_ins ON public.checklist_template_items;
CREATE TRIGGER trg_bump_version_items_ins
  AFTER INSERT ON public.checklist_template_items
  REFERENCING NEW TABLE AS affected
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_checklist_template_version();

DROP TRIGGER IF EXISTS trg_bump_version_items_upd ON public.checklist_template_items;
CREATE TRIGGER trg_bump_version_items_upd
  AFTER UPDATE ON public.checklist_template_items
  REFERENCING NEW TABLE AS affected
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_checklist_template_version();

DROP TRIGGER IF EXISTS trg_bump_version_items_del ON public.checklist_template_items;
CREATE TRIGGER trg_bump_version_items_del
  AFTER DELETE ON public.checklist_template_items
  REFERENCING OLD TABLE AS affected
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_checklist_template_version();

-- ── 2) Restricciones diferibles para el reorden ─────────────────────────────
ALTER TABLE public.checklist_template_items
  DROP CONSTRAINT IF EXISTS checklist_template_items_order_unique;
ALTER TABLE public.checklist_template_items
  ADD CONSTRAINT checklist_template_items_order_unique
    UNIQUE (section_id, sort_order) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE public.checklist_template_sections
  DROP CONSTRAINT IF EXISTS checklist_template_sections_order_unique;
ALTER TABLE public.checklist_template_sections
  ADD CONSTRAINT checklist_template_sections_order_unique
    UNIQUE (template_id, sort_order) DEFERRABLE INITIALLY IMMEDIATE;

-- INITIALLY IMMEDIATE: fuera de las RPC de reorden la llave sigue validando en
-- cada sentencia, como siempre. Solo esas funciones la difieren al COMMIT.

-- ── 3) Plantillas protegidas ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.protect_checklist_templates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.id IN ('fatiga_somnolencia', 'preoperacional_grua_cama') THEN
    RAISE EXCEPTION 'La plantilla % no se puede eliminar: de su id dependen el indice ux_checklists_preop_crane_day y el generador de PDF', OLD.id
      USING ERRCODE = '23503';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_checklist_templates ON public.checklist_templates;
CREATE TRIGGER trg_protect_checklist_templates
  BEFORE DELETE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.protect_checklist_templates();

-- ── 4) Reorden de ítems dentro de una sección ───────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_reorder_checklist_items(
  p_section_id uuid,
  p_item_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total int;
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Solo un administrador puede reordenar el maestro de checklists'
      USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.checklist_template_items
  WHERE section_id = p_section_id;

  -- El arreglo tiene que cubrir la sección COMPLETA: un reorden parcial dejaría
  -- huecos o duplicados en sort_order.
  IF v_total <> array_length(p_item_ids, 1)
     OR EXISTS (
       SELECT 1 FROM unnest(p_item_ids) AS x(id)
       WHERE NOT EXISTS (
         SELECT 1 FROM public.checklist_template_items i
         WHERE i.id = x.id AND i.section_id = p_section_id
       )
     ) THEN
    RAISE EXCEPTION 'El orden recibido no corresponde a los % items de la seccion', v_total
      USING ERRCODE = '22023';
  END IF;

  -- La llave se valida recién al COMMIT: así una sola sentencia puede invertir
  -- la sección entera sin chocar en los estados intermedios.
  SET CONSTRAINTS public.checklist_template_items_order_unique DEFERRED;

  UPDATE public.checklist_template_items i
     SET sort_order = x.ord
    FROM unnest(p_item_ids) WITH ORDINALITY AS x(id, ord)
   WHERE i.id = x.id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reorder_checklist_items(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reorder_checklist_items(uuid, uuid[]) TO authenticated;

-- ── 5) Reorden de secciones ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_reorder_checklist_sections(
  p_template_id text,
  p_section_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total int;
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Solo un administrador puede reordenar el maestro de checklists'
      USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.checklist_template_sections
  WHERE template_id = p_template_id;

  IF v_total <> array_length(p_section_ids, 1)
     OR EXISTS (
       SELECT 1 FROM unnest(p_section_ids) AS x(id)
       WHERE NOT EXISTS (
         SELECT 1 FROM public.checklist_template_sections s
         WHERE s.id = x.id AND s.template_id = p_template_id
       )
     ) THEN
    RAISE EXCEPTION 'El orden recibido no corresponde a las % secciones de la plantilla', v_total
      USING ERRCODE = '22023';
  END IF;

  SET CONSTRAINTS public.checklist_template_sections_order_unique DEFERRED;

  UPDATE public.checklist_template_sections s
     SET sort_order = x.ord
    FROM unnest(p_section_ids) WITH ORDINALITY AS x(id, ord)
   WHERE s.id = x.id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reorder_checklist_sections(text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reorder_checklist_sections(text, uuid[]) TO authenticated;

-- ── 6) Alta de ítem y de sección: se calcula el sort_order en la base ───────
-- Si el cliente eligiera el sort_order, dos altas simultáneas chocarían con la
-- llave única. Acá el "al final de la lista" se resuelve dentro de la misma
-- transacción que el INSERT.
CREATE OR REPLACE FUNCTION public.admin_add_checklist_item(
  p_section_id uuid,
  p_label text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Solo un administrador puede editar el maestro de checklists'
      USING ERRCODE = '42501';
  END IF;

  IF coalesce(btrim(p_label), '') = '' THEN
    RAISE EXCEPTION 'El item necesita un texto' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.checklist_template_items (section_id, label, sort_order, is_active)
  SELECT p_section_id, btrim(p_label),
         coalesce(max(i.sort_order), 0) + 1, true
    FROM public.checklist_template_items i
   WHERE i.section_id = p_section_id
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_checklist_item(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_checklist_item(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_add_checklist_section(
  p_template_id text,
  p_title text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Solo un administrador puede editar el maestro de checklists'
      USING ERRCODE = '42501';
  END IF;

  IF coalesce(btrim(p_title), '') = '' THEN
    RAISE EXCEPTION 'La seccion necesita un titulo' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.checklist_template_sections (template_id, title, sort_order)
  SELECT p_template_id, btrim(p_title), coalesce(max(s.sort_order), 0) + 1
    FROM public.checklist_template_sections s
   WHERE s.template_id = p_template_id
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_checklist_section(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_checklist_section(text, text) TO authenticated;

-- ── 7) Borrado de sección con confirmación explícita ────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_checklist_section(
  p_section_id uuid,
  p_confirm_items boolean DEFAULT false
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_items int;
BEGIN
  IF NOT public.is_admin_user_safe() THEN
    RAISE EXCEPTION 'Solo un administrador puede editar el maestro de checklists'
      USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_items
  FROM public.checklist_template_items
  WHERE section_id = p_section_id;

  -- Con ítems dentro, el borrado exige confirmación. El ON DELETE CASCADE se los
  -- llevaría en silencio y nadie se enteraría hasta armar el próximo checklist.
  IF v_items > 0 AND NOT p_confirm_items THEN
    RAISE EXCEPTION 'La seccion tiene % item(s): confirme el borrado en cascada', v_items
      USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.checklist_template_sections WHERE id = p_section_id;
  RETURN v_items;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_checklist_section(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_checklist_section(uuid, boolean) TO authenticated;

COMMIT;
