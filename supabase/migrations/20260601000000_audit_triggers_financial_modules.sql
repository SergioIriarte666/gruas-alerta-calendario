-- ============================================================
-- AUDIT TRIGGERS FOR FINANCIAL MODULES
-- Agrega triggers de auditoría en audit_log para tablas
-- financieras que actualmente no están cubiertas.
-- ============================================================

-- 0) FUNCIÓN DE AUDITORÍA GENÉRICA (si no existe)
CREATE OR REPLACE FUNCTION public.log_audit_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO audit_log (user_id, operation, table_name, old_data, new_data)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 1) AUDIT TRIGGER: costs (INSERT, UPDATE, DELETE) — condicional
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'costs') THEN
    DROP TRIGGER IF EXISTS trg_audit_costs ON public.costs;
    CREATE TRIGGER trg_audit_costs
      AFTER INSERT OR UPDATE OR DELETE ON public.costs
      FOR EACH ROW
      EXECUTE FUNCTION public.log_audit_changes();
  END IF;
END;
$$;

-- 2) AUDIT TRIGGER: commissions (INSERT, UPDATE, DELETE) — condicional
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'commissions') THEN
    DROP TRIGGER IF EXISTS trg_audit_commissions ON public.commissions;
    CREATE TRIGGER trg_audit_commissions
      AFTER INSERT OR UPDATE OR DELETE ON public.commissions
      FOR EACH ROW
      EXECUTE FUNCTION public.log_audit_changes();
  END IF;
END;
$$;

-- 3) AUDIT TRIGGER: inventory_movements (INSERT) — condicional
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_movements') THEN
    DROP TRIGGER IF EXISTS trg_audit_inventory_movements ON public.inventory_movements;
    CREATE TRIGGER trg_audit_inventory_movements
      AFTER INSERT ON public.inventory_movements
      FOR EACH ROW
      EXECUTE FUNCTION public.log_audit_changes();
  END IF;
END;
$$;

-- 4) AUDIT TRIGGER: supplier_payments (INSERT, UPDATE, DELETE) — condicional
--    Equivalente a cuentas por pagar (accounts_payable)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'supplier_payments') THEN
    DROP TRIGGER IF EXISTS trg_audit_supplier_payments ON public.supplier_payments;
    CREATE TRIGGER trg_audit_supplier_payments
      AFTER INSERT OR UPDATE OR DELETE ON public.supplier_payments
      FOR EACH ROW
      EXECUTE FUNCTION public.log_audit_changes();
  END IF;
END;
$$;
