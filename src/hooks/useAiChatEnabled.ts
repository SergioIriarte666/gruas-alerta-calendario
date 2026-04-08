import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useAiChatEnabled = () => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('ai_chat_enabled')
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setEnabled((data as any).ai_chat_enabled ?? false);
        }
      } catch (e) {
        console.error('Error fetching ai_chat_enabled:', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { enabled, loading };
};
