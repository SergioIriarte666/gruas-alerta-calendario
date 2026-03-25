-- Auto-asignación de centro de costo en UPDATE:
-- Si el costo se edita y el centro está vacío, asigna el default de la categoría

DROP TRIGGER IF EXISTS trigger_assign_cost_center_on_update ON public.costs;
CREATE TRIGGER trigger_assign_cost_center_on_update
  BEFORE UPDATE ON public.costs
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_cost_center();
