
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
      // Use the correct realtime event handlers
      this.client.realtime.on('error', (error: any) => {
        // Only log critical WebSocket errors
        if (!this.isConnectionError(error)) {
          console.warn('Realtime connection issue:', error.message || error);
        }
      });

      this.client.realtime.on('close', () => {
        // Attempt graceful reconnection
        setTimeout(() => {
          try {
            this.client.realtime.connect();
          } catch (error) {
            console.warn('Failed to reconnect realtime:', error);
          }
        }, 2000);
      });
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
