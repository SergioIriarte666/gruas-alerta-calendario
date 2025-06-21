
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { SupabaseErrorHandler } from '@/utils/supabaseErrorHandler';

const SUPABASE_URL = "https://jqszxljtfuknhuvuheko.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impxc3p4bGp0ZnVrbmh1dnVoZWtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NjcxMDEsImV4cCI6MjA2NTQ0MzEwMX0.vsTKjDOp6_eTi4IaOEOfABfEtJEtUPtUa_WmZ-QLZic";

// Create enhanced Supabase client with better error handling
const baseClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    heartbeatIntervalMs: 30000,
    reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 30000),
  },
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

export const enhancedSupabase = new SupabaseErrorHandler(baseClient);
export const supabase = enhancedSupabase.getClient();
