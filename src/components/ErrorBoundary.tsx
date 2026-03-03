import React, { Component, ErrorInfo, ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

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
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Algo salió mal en {this.props.name || 'este componente'}</AlertTitle>
          <AlertDescription className="mt-2 space-y-4">
            <p>Se ha producido un error inesperado.</p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="text-xs bg-black/10 p-2 rounded overflow-auto max-h-[200px]">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            )}
            <Button onClick={this.handleReset} variant="outline" size="sm" className="mt-2">
              <RefreshCw className="mr-2 h-3 w-3" />
              Intentar de nuevo
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}
