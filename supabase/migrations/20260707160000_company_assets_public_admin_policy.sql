BEGIN;

-- Los assets corporativos (logo de empresa) viven en company-assets/public/
-- y deben poder ser gestionados por administradores desde Configuración.
-- Las políticas por-usuario existentes (carpeta = auth.uid()) se mantienen intactas.

CREATE POLICY "Admins can insert public company assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-assets'
  AND (storage.foldername(name))[1] = 'public'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update public company assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-assets'
  AND (storage.foldername(name))[1] = 'public'
  AND public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id = 'company-assets'
  AND (storage.foldername(name))[1] = 'public'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete public company assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'company-assets'
  AND (storage.foldername(name))[1] = 'public'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

COMMIT;
