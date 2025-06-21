
import { SupabaseClient } from '@supabase/supabase-js';
import { connectionManager } from './connectionManager';

/**
 * Enhanced Supabase client wrapper with error handling and retry logic
 */
export class SupabaseErrorHandler {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
    this.setupRealtimeErrorHandling();
  }

  private setupRealtimeErrorHandling(): void {
    // Handle WebSocket connection errors gracefully
    if (this.client.realtime) {
      this.client.realtime.onError = (error: any) => {
        // Only log critical WebSocket errors
        if (!this.isConnectionError(error)) {
          console.warn('Realtime connection issue:', error.message || error);
        }
      };

      this.client.realtime.onClose = () => {
        // Attempt graceful reconnection
        setTimeout(() => {
          if (this.client.realtime.socket?.readyState === WebSocket.CLOSED) {
            this.client.realtime.connect();
          }
        }, 2000);
      };
    }
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
