import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BackupEmailConfig {
  id: string;
  enabled: boolean;
  recipient_email: string;
  schedule_hour: number;
  signed_url_days: number;
  last_sent_at: string | null;
  last_status: string | null;
  last_error: string | null;
  last_sql_size_bytes: number | null;
  last_json_size_bytes: number | null;
}

export const useBackupEmailConfig = () => {
  const [config, setConfig] = useState<BackupEmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('backup_email_config')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (!error) setConfig(data as BackupEmailConfig | null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (updates: Partial<BackupEmailConfig>) => {
    if (!config) return { error: 'No config' };
    setSaving(true);
    const { error } = await supabase
      .from('backup_email_config')
      .update(updates)
      .eq('id', config.id);
    setSaving(false);
    if (!error) await load();
    return { error: error?.message };
  }, [config, load]);

  const sendTest = useCallback(async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('scheduled-backup-email', {
        body: { force: true },
      });
      if (error) return { error: error.message };
      if ((data as any)?.success === false) return { error: (data as any).error };
      await load();
      return { data };
    } finally {
      setTesting(false);
    }
  }, [load]);

  return { config, loading, saving, testing, save, sendTest, reload: load };
};