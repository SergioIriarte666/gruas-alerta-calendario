import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useCompanyProfiles');

export interface CompanyProfile {
  rut: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
}

const QUERY_KEY = ['company-profiles'];

const SELECT_CLAUSE = 'rut, name, address, phone, email, logo_url';

export const useCompanyProfiles = () => {
  return useQuery<CompanyProfile[]>({
    queryKey: QUERY_KEY,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_profiles')
        .select(SELECT_CLAUSE)
        .order('name', { ascending: true });
      if (error) {
        logger.error('Error loading company profiles:', error);
        throw error;
      }
      return data ?? [];
    },
  });
};

export const useSaveCompanyProfile = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();

  return useMutation({
    mutationFn: async (payload: CompanyProfile) => {
      const { error } = await supabase
        .from('company_profiles')
        .upsert(payload, { onConflict: 'rut' });
      if (error) throw error;
      return payload.rut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: createMutationErrorHandler({
      title: 'Error al guardar empresa',
      context: 'useSaveCompanyProfile',
    }),
  });
};

export interface UpdateCompanyProfileLogoArgs {
  rut: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logoFile: File | null;
  currentLogoUrl: string | null;
}

export const useUpdateCompanyProfileLogo = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();

  return useMutation({
    mutationFn: async ({
      rut,
      name,
      address,
      phone,
      email,
      logoFile,
      currentLogoUrl,
    }: UpdateCompanyProfileLogoArgs) => {
      let newLogoUrl: string | null = currentLogoUrl;
      let uploadedPath: string | undefined;

      if (logoFile) {
        uploadedPath = `public/company-profile-${rut}-${Date.now()}-${logoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('company-assets')
          .upload(uploadedPath, logoFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from('company-assets')
          .getPublicUrl(uploadedPath);
        newLogoUrl = urlData.publicUrl;
      } else if (logoFile === null) {
        newLogoUrl = null;
      }

      const { error: upsertError } = await supabase.from('company_profiles').upsert(
        {
          rut,
          name: name.trim(),
          address: address.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          logo_url: newLogoUrl,
        },
        { onConflict: 'rut' },
      );

      if (upsertError) {
        if (uploadedPath) {
          await supabase.storage.from('company-assets').remove([uploadedPath]);
        }
        throw upsertError;
      }

      if (currentLogoUrl && newLogoUrl !== currentLogoUrl) {
        const oldPath = currentLogoUrl.split('/company-assets/')[1]?.split('?')[0];
        if (oldPath) {
          await supabase.storage.from('company-assets').remove([oldPath]);
        }
      }

      return newLogoUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: createMutationErrorHandler({
      title: 'Error al actualizar logotipo',
      context: 'useUpdateCompanyProfileLogo',
    }),
  });
};
