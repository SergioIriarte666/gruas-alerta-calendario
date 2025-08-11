
/**
 * Connection Manager utility for handling WebSocket connections and network errors
 */

interface ConnectionConfig {
  maxRetries?: number;
  retryDelay?: number;
  enableLogging?: boolean;
}

export class ConnectionManager {
  private static instance: ConnectionManager;
  private retryCount = 0;
  private config: ConnectionConfig = {
    maxRetries: 3,
    retryDelay: 2000,
    enableLogging: false
  };

  private constructor(config?: ConnectionConfig) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  static getInstance(config?: ConnectionConfig): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager(config);
    }
    return ConnectionManager.instance;
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    context: string = 'operation'
  ): Promise<T> {
    try {
      const result = await operation();
      this.retryCount = 0; // Reset on success
      return result;
    } catch (error: any) {
      if (this.retryCount < (this.config.maxRetries || 3)) {
        this.retryCount++;
        
        if (this.config.enableLogging) {
          console.log(`Retrying ${context} (attempt ${this.retryCount}/${this.config.maxRetries})`);
        }
        
        await this.delay(this.config.retryDelay || 2000);
        return this.withRetry(operation, context);
      }
      
      // Log only critical errors, filter out external service errors
      if (!this.isExternalServiceError(error)) {
        console.error(`${context} failed after ${this.config.maxRetries} retries:`, error);
      }
      
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isExternalServiceError(error: any): boolean {
    const externalErrors = [
      'cloudflare',
      'insights',
      'cdn-cgi',
      'net::ERR_BLOCKED_BY_CLIENT',
      'ERR_INTERNET_DISCONNECTED'
    ];
    
    const errorMessage = error?.message?.toLowerCase() || '';
    return externalErrors.some(pattern => errorMessage.includes(pattern));
  }

  filterConsoleErrors(): void {
    const originalError = console.error;
    console.error = (...args) => {
      const message = args.join(' ').toLowerCase();
      
      // Filter out external service errors
      if (this.isExternalServiceError({ message })) {
        return; // Don't log external service errors
      }
      
      // Filter out specific non-critical errors
      if (
        message.includes('cloudflare') ||
        message.includes('cdn-cgi') ||
        message.includes('insights') ||
        message.includes('net::err_blocked_by_client')
      ) {
        return;
      }
      
      originalError.apply(console, args);
    };
  }
}

// Initialize connection manager with filtered console errors
export const connectionManager = ConnectionManager.getInstance({
  maxRetries: 3,
  retryDelay: 1500,
  enableLogging: false
});

// Auto-filter console errors on import
connectionManager.filterConsoleErrors();
