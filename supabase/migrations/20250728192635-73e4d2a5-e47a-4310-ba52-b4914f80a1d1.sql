-- Permitir valores NULL en crane_id y operator_id para servicios que no los requieran
ALTER TABLE public.services 
ALTER COLUMN crane_id DROP NOT NULL;

ALTER TABLE public.services 
ALTER COLUMN operator_id DROP NOT NULL;