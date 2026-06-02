import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ImportType = 'purchase' | 'sale';
export type ImportMappingResolution = 'create' | 'assign' | 'ignore';

export interface ImportRutMapping {
  id: string;
  organization_id: string;
  import_type: ImportType;
  source_rut: string;
  source_name: string;
  resolution: ImportMappingResolution;
  mapped_entity_id: string | null;
  mapped_entity_name: string | null;
  created_at: string;
  updated_at: string;
}

const normalizeRut = (rut: string) =>
  rut.replace(/[^0-9Kk]/g, '').trim().toUpperCase();

const mapImportRutMapping = (row: any): ImportRutMapping => ({
  id: row.id,
  organization_id: row.organization_id,
  import_type: row.import_type,
  source_rut: row.source_rut,
  source_name: row.source_name,
  resolution: row.resolution,
  mapped_entity_id: row.mapped_entity_id ?? null,
  mapped_entity_name: row.mapped_entity_name ?? null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const fetchMappings = async (importType: ImportType): Promise<ImportRutMapping[]> => {
  const { data, error } = await supabase
    .from('import_rut_mappings')
    .select('*')
    .eq('import_type', importType)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapImportRutMapping);
};

export const useImportMappings = (importType?: ImportType) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['import-rut-mappings', importType],
    queryFn: () => fetchMappings(importType as ImportType),
    enabled: Boolean(importType),
    staleTime: 60_000,
  });

  const getMappings = useCallback(
    async (requestedImportType: ImportType) =>
      queryClient.fetchQuery({
        queryKey: ['import-rut-mappings', requestedImportType],
        queryFn: () => fetchMappings(requestedImportType),
        staleTime: 60_000,
      }),
    [queryClient]
  );

  const getMapping = useCallback(
    async (requestedImportType: ImportType, rut: string) => {
      const mappings = await getMappings(requestedImportType);
      const normalizedRut = normalizeRut(rut);

      return (
        mappings.find((mapping) => normalizeRut(mapping.source_rut) === normalizedRut) ?? null
      );
    },
    [getMappings]
  );

  const saveMapping = useCallback(
    async (
      requestedImportType: ImportType,
      rut: string,
      name: string,
      resolution: ImportMappingResolution,
      entityId?: string | null,
      entityName?: string | null
    ) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        throw new Error('No se pudo obtener el usuario actual para guardar el mapping.');
      }

      const normalizedRut = normalizeRut(rut);

      const payload = {
        organization_id: user.id,
        import_type: requestedImportType,
        source_rut: normalizedRut,
        source_name: name,
        resolution,
        mapped_entity_id: entityId ?? null,
        mapped_entity_name: entityName ?? null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('import_rut_mappings')
        .upsert(payload, {
          onConflict: 'organization_id,import_type,source_rut',
        })
        .select('*')
        .single();

      if (error) throw error;

      await queryClient.invalidateQueries({
        queryKey: ['import-rut-mappings', requestedImportType],
      });

      return mapImportRutMapping(data);
    },
    [queryClient]
  );

  return {
    mappings: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    getMappings,
    getMapping,
    saveMapping,
  };
};
