-- Add custody columns to services table
ALTER TABLE public.services ADD COLUMN custody_mode TEXT CHECK (custody_mode IN ('manual', 'calendar', 'none')) DEFAULT 'none';
ALTER TABLE public.services ADD COLUMN custody_days INTEGER;
ALTER TABLE public.services ADD COLUMN custody_daily_rate NUMERIC;
ALTER TABLE public.services ADD COLUMN custody_start_date DATE;
ALTER TABLE public.services ADD COLUMN custody_end_date DATE;
ALTER TABLE public.services ADD COLUMN custody_vehicle_type TEXT;
ALTER TABLE public.services ADD COLUMN custody_discount_percentage NUMERIC DEFAULT 0 CHECK (custody_discount_percentage >= 0 AND custody_discount_percentage <= 100);
ALTER TABLE public.services ADD COLUMN custody_total_amount NUMERIC;
ALTER TABLE public.services ADD COLUMN custody_notes TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.services.custody_mode IS 'Vehicle custody mode: manual (specific days), calendar (date range), or none';
COMMENT ON COLUMN public.services.custody_days IS 'Number of custody days';
COMMENT ON COLUMN public.services.custody_daily_rate IS 'Daily rate for custody service';
COMMENT ON COLUMN public.services.custody_start_date IS 'Custody start date (for calendar mode)';
COMMENT ON COLUMN public.services.custody_end_date IS 'Custody end date (for calendar mode)';
COMMENT ON COLUMN public.services.custody_vehicle_type IS 'Type of vehicle under custody';
COMMENT ON COLUMN public.services.custody_discount_percentage IS 'Discount percentage applied to custody service';
COMMENT ON COLUMN public.services.custody_total_amount IS 'Total amount for custody service';
COMMENT ON COLUMN public.services.custody_notes IS 'Additional notes for custody service';