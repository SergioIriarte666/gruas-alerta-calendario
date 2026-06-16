BEGIN;

-- Importaciones de cartolas bancarias
CREATE TABLE IF NOT EXISTS bank_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  bank TEXT NOT NULL DEFAULT 'Santander',
  account_number TEXT,
  period_from DATE,
  period_to DATE,
  total_movements INTEGER DEFAULT 0,
  total_credits INTEGER DEFAULT 0,
  total_amount BIGINT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

-- Movimientos de abono extraídos (NUNCA se guardan cargos)
CREATE TABLE IF NOT EXISTS bank_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES bank_imports(id) ON DELETE CASCADE,
  movement_date DATE NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  reference TEXT,
  branch TEXT,
  extracted_rut TEXT,
  extracted_invoice_ref TEXT,
  extracted_payer_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'matched', 'reconciled', 'exception')),
  suggested_invoice_id UUID REFERENCES invoices(id),
  match_confidence TEXT CHECK (match_confidence IN ('high', 'medium', 'low')),
  match_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Conciliaciones confirmadas por el usuario
CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id UUID NOT NULL UNIQUE REFERENCES bank_movements(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  reconciled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reconciled_by UUID REFERENCES profiles(id),
  notes TEXT
);

-- RLS
ALTER TABLE bank_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_bank_imports" ON bank_imports
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_all_bank_movements" ON bank_movements
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_all_bank_reconciliations" ON bank_reconciliations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Índices
CREATE INDEX IF NOT EXISTS idx_bank_movements_import_id ON bank_movements(import_id);
CREATE INDEX IF NOT EXISTS idx_bank_movements_status ON bank_movements(status);
CREATE INDEX IF NOT EXISTS idx_bank_movements_extracted_rut ON bank_movements(extracted_rut);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_invoice_id ON bank_reconciliations(invoice_id);

COMMIT;
