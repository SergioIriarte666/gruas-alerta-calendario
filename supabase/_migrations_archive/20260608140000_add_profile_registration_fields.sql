BEGIN;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS rut TEXT;

-- Usuarios existentes ya aprobados (no romper acceso actual)
UPDATE profiles SET status = 'approved' WHERE status = 'pending';

COMMENT ON COLUMN profiles.status IS 'pending=esperando aprobación, approved=activo, rejected=rechazado';

COMMIT;
