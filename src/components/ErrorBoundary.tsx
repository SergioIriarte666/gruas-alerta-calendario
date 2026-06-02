import React, { Component, ErrorInfo, ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

const isDev = import.meta.env.DEV;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const reportFrontendError = (payload: {
  componentName: string;
  errorMessage: string;
  errorStack?: string;
  url: string;
}) => {
  const fnUrl = `${SUPABASE_URL}/functions/v1/log-frontend-error`;

  return fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  });
};

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary] Error in ${this.props.name || 'Component'}:`, error, errorInfo);
    this.setState({ errorInfo });

    if (!isDev) {
      try {
        reportFrontendError({
          componentName: this.props.name || 'Unknown',
          errorMessage: error.message || String(error),
          errorStack: error.stack || errorInfo.componentStack || undefined,
          url: window.location.href || '',
        }).catch(() => {});
      } catch { }
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Alert variant="destructive" className="my-4">
          <AlertCircle className="size-4" />
          <AlertTitle>Algo salió mal en {this.props.name || 'este componente'}</AlertTitle>
          <AlertDescription className="mt-2 space-y-4">
            <p>Se ha producido un error inesperado.</p>
            {isDev && this.state.error && (
              <pre className="text-xs bg-black/10 p-2 rounded overflow-auto max-h-[200px]">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            )}
            <Button onClick={this.handleReset} variant="outline" size="sm" className="mt-2">
              <RefreshCw className="mr-2 size-3" />
              Intentar de nuevo
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}
