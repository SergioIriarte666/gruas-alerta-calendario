import { supabase } from '@/integrations/supabase/client';

export const VIP_BATCH_CHUNK_SIZE = 25;

export interface VipServiceBatchUpdateItem {
  id: string;
  quote_number?: string | null;
  purchase_order?: string | null;
  target_status?: string | null;
}

export interface VipServiceBatchProgress {
  processedCount: number;
  totalCount: number;
  currentLabel: string;
}

export interface VipServiceBatchResult {
  successCount: number;
  failedIds: string[];
}

interface VipBatchUpdateResult {
  success: boolean;
  updated_count?: number;
  updated_ids?: string[];
  missing_ids?: string[];
  error?: string;
}

export const applyVipServiceBatchUpdates = async ({
  updates,
  getLabel,
  onProgress,
}: {
  updates: VipServiceBatchUpdateItem[];
  getLabel?: (update: VipServiceBatchUpdateItem, index: number) => string;
  onProgress?: (progress: VipServiceBatchProgress) => void;
}): Promise<VipServiceBatchResult> => {
  let successCount = 0;
  let processedCount = 0;
  const failedIds: string[] = [];

  for (let index = 0; index < updates.length; index += VIP_BATCH_CHUNK_SIZE) {
    const chunk = updates.slice(index, index + VIP_BATCH_CHUNK_SIZE);
    const { data, error } = await supabase.rpc('update_vip_services_batch', {
      p_updates: chunk as unknown as never,
    });
    const result = data as unknown as VipBatchUpdateResult | null;

    processedCount += chunk.length;
    onProgress?.({
      processedCount: Math.min(processedCount, updates.length),
      totalCount: updates.length,
      currentLabel: getLabel?.(chunk[chunk.length - 1], processedCount - 1) || `Servicio ${processedCount}`,
    });

    if (error || !result?.success) {
      failedIds.push(...chunk.map((item) => item.id));
      continue;
    }

    const updatedIds: string[] = Array.isArray(result.updated_ids)
      ? result.updated_ids.filter((serviceId: unknown): serviceId is string => typeof serviceId === 'string')
      : [];
    const missingIds: string[] = Array.isArray(result.missing_ids)
      ? result.missing_ids.filter((serviceId: unknown): serviceId is string => typeof serviceId === 'string')
      : [];

    successCount += typeof result.updated_count === 'number' ? result.updated_count : updatedIds.length;
    failedIds.push(...missingIds);
  }

  return {
    successCount,
    failedIds,
  };
};
