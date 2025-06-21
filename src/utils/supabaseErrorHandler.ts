
import { SupabaseClient } from '@supabase/supabase-js';
import { connectionManager } from './connectionManager';

/**
 * Enhanced Supabase client wrapper with error handling and retry logic
 */
export class SupabaseErrorHandler {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  private isConnectionError(error: any): boolean {
    const connectionErrors = [
      'websocket',
      'connection',
      'network',
      'timeout',
      'disconnected'
    ];
    
    const errorMessage = error?.message?.toLowerCase() || '';
    return connectionErrors.some(pattern => errorMessage.includes(pattern));
  }

  async query<T>(
    operation: () => Promise<{ data: T; error: any }>,
    context: string = 'query'
  ): Promise<{ data: T; error: any }> {
    return connectionManager.withRetry(async () => {
      const result = await operation();
      
      if (result.error && !this.isConnectionError(result.error)) {
        console.error(`Supabase ${context} error:`, result.error);
      }
      
      return result;
    }, `Supabase ${context}`);
  }

  getClient(): SupabaseClient {
    return this.client;
  }
}
