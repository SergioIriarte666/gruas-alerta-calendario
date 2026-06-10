-- Add custody_rate_type column to services table
ALTER TABLE public.services 
ADD COLUMN custody_rate_type TEXT DEFAULT 'daily';

-- Add comment to explain the column
COMMENT ON COLUMN public.services.custody_rate_type IS 'Type of custody rate: daily, weekly, or monthly. Used to display original rate in UI.';