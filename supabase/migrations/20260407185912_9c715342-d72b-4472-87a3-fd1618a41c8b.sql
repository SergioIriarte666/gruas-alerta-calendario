
-- 1. Fix supplier_invoice_items: remove public SELECT, add authenticated-only
DROP POLICY IF EXISTS "supplier_invoice_items_select_policy" ON supplier_invoice_items;

CREATE POLICY "supplier_invoice_items_select_authenticated"
  ON supplier_invoice_items
  FOR SELECT TO authenticated
  USING (is_authenticated_user_safe());

-- 2. Fix service_cash_receipts: scope SELECT by role
DROP POLICY IF EXISTS "service_cash_receipts_select" ON service_cash_receipts;

CREATE POLICY "service_cash_receipts_select_scoped"
  ON service_cash_receipts
  FOR SELECT TO authenticated
  USING (
    is_admin_user_safe()
    OR is_operator_user_safe()
    OR (
      is_client_user_safe()
      AND EXISTS (
        SELECT 1 FROM services s
        WHERE s.id = service_cash_receipts.service_id
          AND s.client_id = get_user_client_id_safe()
      )
    )
  );

-- 3. Fix costs operator access: scope to assigned services
DROP POLICY IF EXISTS "costs_operator_access" ON costs;

CREATE POLICY "costs_operator_scoped_access"
  ON costs
  FOR SELECT TO authenticated
  USING (
    is_operator_user_safe()
    AND (
      EXISTS (
        SELECT 1 FROM operators o
        WHERE o.user_id = auth.uid()
          AND o.id = costs.operator_id
      )
      OR EXISTS (
        SELECT 1 FROM operators o
        JOIN services s ON s.id = costs.service_id
        WHERE o.user_id = auth.uid()
          AND (
            s.operator_id = o.id
            OR EXISTS (
              SELECT 1 FROM service_resources sr
              WHERE sr.service_id = s.id AND sr.operator_id = o.id
            )
          )
      )
    )
  );
