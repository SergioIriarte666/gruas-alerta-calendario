-- Agregar FK hacia profiles para que PostgREST pueda hacer JOIN profiles:changed_by
ALTER TABLE public.cost_change_history
  ADD CONSTRAINT cost_change_history_changed_by_profile_fkey
  FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_movement_change_history
  ADD CONSTRAINT inventory_movement_change_history_changed_by_profile_fkey
  FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.crane_part_change_history
  ADD CONSTRAINT crane_part_change_history_changed_by_profile_fkey
  FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;