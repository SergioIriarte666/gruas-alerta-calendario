
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
      // Use the correct realtime event handlers for Supabase v2
      this.client.realtime.onOpen(() => {
        console.log('Realtime connection opened');
      });

      this.client.realtime.onClose((event) => {
        // Only log if it's not a normal closure
        if (event && event.code !== 1000) {
          console.warn('Realtime connection closed:', event.code, event.reason);
        }
        
        // Attempt graceful reconnection after a delay
        setTimeout(() => {
          try {
            if (this.client.realtime.isConnected() === false) {
              this.client.realtime.connect();
            }
          } catch (error) {
            // Silently handle reconnection errors - they're not critical
          }
        }, 2000);
      });

      this.client.realtime.onError((error) => {
        // Only log critical WebSocket errors, filter out connection issues
        if (!this.isConnectionError(error)) {
          console.warn('Realtime error:', error);
        }
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
