-- Create payment_terms table
CREATE TABLE payment_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  days INTEGER DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX idx_payment_terms_active ON payment_terms(is_active);
CREATE INDEX idx_payment_terms_code ON payment_terms(code);

-- Enable RLS
ALTER TABLE payment_terms ENABLE ROW LEVEL SECURITY;

-- RLS Policy for authenticated users
CREATE POLICY "payment_terms_authenticated_access" 
ON payment_terms FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Add payment_term_id to invoices table
ALTER TABLE invoices 
ADD COLUMN payment_term_id UUID REFERENCES payment_terms(id);

CREATE INDEX idx_invoices_payment_term ON invoices(payment_term_id);

-- Add default_payment_term_id to clients table
ALTER TABLE clients 
ADD COLUMN default_payment_term_id UUID REFERENCES payment_terms(id);

-- Insert initial payment terms
INSERT INTO payment_terms (name, code, days, description, display_order) VALUES
('Contado', 'cash', 0, 'Pago al momento de la facturación', 1),
('Transferencia', 'transfer', 0, 'Pago mediante transferencia bancaria', 2),
('Crédito 7 días', 'credit_7', 7, 'Crédito a 7 días corridos', 3),
('Crédito 15 días', 'credit_15', 15, 'Crédito a 15 días corridos', 4),
('Crédito 30 días', 'credit_30', 30, 'Crédito a 30 días corridos', 5),
('Crédito 60 días', 'credit_60', 60, 'Crédito a 60 días corridos', 6),
('Crédito 90 días', 'credit_90', 90, 'Crédito a 90 días corridos', 7),
('Cheque', 'check', 30, 'Pago mediante cheque', 8);