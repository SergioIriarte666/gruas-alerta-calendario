-- Create crane_documents table for storing document metadata
CREATE TABLE public.crane_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crane_id UUID NOT NULL REFERENCES public.cranes(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- 'technical_review', 'insurance', 'circulation_permit'
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  content_type TEXT,
  expiry_date DATE,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(crane_id, document_type)
);

-- Enable RLS
ALTER TABLE public.crane_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin can manage all crane documents"
ON public.crane_documents
FOR ALL
USING (is_admin_user())
WITH CHECK (is_admin_user());

CREATE POLICY "Users can view crane documents"
ON public.crane_documents
FOR SELECT
USING (true);

-- Create storage bucket for crane documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('crane-documents', 'crane-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public read access for crane documents"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'crane-documents');

CREATE POLICY "Authenticated users can upload crane documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'crane-documents');

CREATE POLICY "Users can update crane documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'crane-documents');

CREATE POLICY "Users can delete crane documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'crane-documents');

-- Function to update crane expiry dates when document is uploaded
CREATE OR REPLACE FUNCTION public.update_crane_expiry_on_document_upload()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the corresponding expiry date in cranes table
  IF NEW.document_type = 'technical_review' AND NEW.expiry_date IS NOT NULL THEN
    UPDATE public.cranes 
    SET technical_review_expiry = NEW.expiry_date, updated_at = now()
    WHERE id = NEW.crane_id;
  ELSIF NEW.document_type = 'insurance' AND NEW.expiry_date IS NOT NULL THEN
    UPDATE public.cranes 
    SET insurance_expiry = NEW.expiry_date, updated_at = now()
    WHERE id = NEW.crane_id;
  ELSIF NEW.document_type = 'circulation_permit' AND NEW.expiry_date IS NOT NULL THEN
    UPDATE public.cranes 
    SET circulation_permit_expiry = NEW.expiry_date, updated_at = now()
    WHERE id = NEW.crane_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update crane expiry dates
CREATE TRIGGER update_crane_expiry_trigger
  AFTER INSERT OR UPDATE ON public.crane_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crane_expiry_on_document_upload();

-- Trigger for updated_at timestamp
CREATE TRIGGER update_crane_documents_updated_at
  BEFORE UPDATE ON public.crane_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();