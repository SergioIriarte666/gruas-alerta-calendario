-- answer_type deja de ser uniforme por plantilla.
--
-- El pre-operacional mezcla DOS naturalezas: una sección documental (permiso de
-- circulación, revisión técnica, SOAP, licencia) y cinco de estado físico. Un
-- permiso de circulación no está "bueno" ni "malo": está vigente o no lo está.
-- Firmar "M" en un SOAP equivale a declarar que el camión salió sin seguro, y la
-- palabra que queda en el documento firmado importa legalmente.
--
-- La resolución pasa a ser en CASCADA, de lo más específico a lo más general:
--   ítem.answer_type -> sección.answer_type -> plantilla.answer_type
-- NULL significa "hereda". Hoy solo se puebla la sección documental y todo lo
-- demás sigue heredando de la plantilla, así que ningún documento existente
-- cambia de comportamiento.
--
-- La columna a nivel de ÍTEM se agrega ahora aunque nadie la use todavía: si
-- mañana un ítem suelto necesita otro tipo, no hace falta otra migración, y la
-- pantalla de administración del maestro (Fase 5) podrá editar ambos niveles.
--
-- SIN CHECK que enumere los valores a propósito: el universo válido se resuelve
-- en TypeScript (resolveAnswerType / getAnswerOptions). Un CHECK obligaría a
-- migrar la base cada vez que se agregue un tipo de respuesta nuevo.

BEGIN;

ALTER TABLE public.checklist_template_sections
  ADD COLUMN IF NOT EXISTS answer_type text;

ALTER TABLE public.checklist_template_items
  ADD COLUMN IF NOT EXISTS answer_type text;

COMMENT ON COLUMN public.checklist_template_sections.answer_type IS
  'Tipo de respuesta de la sección. NULL = hereda el de la plantilla. '
  'Cascada: ítem -> sección -> plantilla.';

COMMENT ON COLUMN public.checklist_template_items.answer_type IS
  'Tipo de respuesta del ítem, el más específico de la cascada. NULL = hereda el '
  'de su sección y, si esa también es NULL, el de la plantilla.';

-- Sección 1 del pre-operacional: DOCUMENTACIÓN DEL VEHÍCULO.
UPDATE public.checklist_template_sections
   SET answer_type = 'vigente_no_na'
 WHERE template_id = 'preoperacional_grua_cama'
   AND sort_order = 1;

-- La plantilla cambió de forma: los documentos nuevos se firman con la v2. Los ya
-- firmados conservan su template_version y su items_snapshot, que es lo que
-- realmente decide cómo se renderizan.
UPDATE public.checklist_templates
   SET version = 2
 WHERE id = 'preoperacional_grua_cama';

-- 'fatiga_somnolencia' NO se toca: sus 6 ítems son si/no/na de punta a punta.

COMMIT;
