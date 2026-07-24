-- Las facturas históricas se conservan para administración y operación,
-- pero no forman parte de la cuenta corriente visible en Portal Clientes.

DROP POLICY IF EXISTS "invoices_client_own" ON public.invoices;

CREATE POLICY "invoices_client_own"
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    public.is_client_user_safe()
    AND client_id = public.get_user_client_id_safe()
    AND upper(coalesce(folio, '')) NOT LIKE 'HIST-%'
  );

COMMENT ON POLICY "invoices_client_own" ON public.invoices IS
  'Clientes solo pueden leer sus facturas no históricas; administración conserva acceso completo.';
