-- Create table for quick entries
CREATE TABLE public.quick_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('service', 'cost', 'inventory', 'maintenance')),
  description TEXT NOT NULL,
  amount NUMERIC,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'discarded')),
  data JSONB DEFAULT '{}',
  photo_url TEXT,
  location JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.quick_entries ENABLE ROW LEVEL SECURITY;

-- Create policies for quick entries (admin only)
CREATE POLICY "Admin can manage quick entries" 
ON public.quick_entries 
FOR ALL 
USING (is_admin_user())
WITH CHECK (is_admin_user());

-- Create trigger for updated_at
CREATE TRIGGER update_quick_entries_updated_at
BEFORE UPDATE ON public.quick_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();