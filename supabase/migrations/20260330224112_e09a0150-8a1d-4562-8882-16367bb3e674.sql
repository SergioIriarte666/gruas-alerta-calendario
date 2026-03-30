
-- Fix: Restrict write policies on financial debt tables to admin only (remove viewer write access)

-- 1. creditors: drop viewer write policy, recreate admin-only
DROP POLICY IF EXISTS "creditors_write_admin_viewer" ON creditors;
CREATE POLICY "creditors_write_admin_only" ON creditors
  FOR ALL TO authenticated
  USING (get_current_user_role_safe() = 'admin'::app_role)
  WITH CHECK (get_current_user_role_safe() = 'admin'::app_role);

-- 2. debts: drop viewer write policy, recreate admin-only
DROP POLICY IF EXISTS "debts_write_admin_viewer" ON debts;
CREATE POLICY "debts_write_admin_only" ON debts
  FOR ALL TO authenticated
  USING (get_current_user_role_safe() = 'admin'::app_role)
  WITH CHECK (get_current_user_role_safe() = 'admin'::app_role);

-- 3. debt_installments: drop viewer write policy, recreate admin-only
DROP POLICY IF EXISTS "debt_installments_write_admin_viewer" ON debt_installments;
CREATE POLICY "debt_installments_write_admin_only" ON debt_installments
  FOR ALL TO authenticated
  USING (get_current_user_role_safe() = 'admin'::app_role)
  WITH CHECK (get_current_user_role_safe() = 'admin'::app_role);

-- 4. debt_payments: drop viewer write policy, recreate admin-only
DROP POLICY IF EXISTS "debt_payments_write_admin_viewer" ON debt_payments;
CREATE POLICY "debt_payments_write_admin_only" ON debt_payments
  FOR ALL TO authenticated
  USING (get_current_user_role_safe() = 'admin'::app_role)
  WITH CHECK (get_current_user_role_safe() = 'admin'::app_role);
