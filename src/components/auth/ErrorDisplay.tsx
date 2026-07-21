
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorDisplayProps {
  authUser: any;
  profileError: string;
  onRetryProfile: () => void;
  onForceRefresh: () => void;
  onCleanupAndRestart: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  authUser,
  profileError,
  onRetryProfile,
  onForceRefresh,
  onCleanupAndRestart
}) => {
  return (
    <Card className="w-full max-w-md border border-auth-input-border bg-auth-surface/95 shadow-xl backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-auth-input-foreground">Error de Perfil</CardTitle>
        <CardDescription className="text-auth-danger">{profileError}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 bg-transparent">
        <div className="text-sm text-auth-input-foreground">
          <p>Usuario autenticado: {authUser.email}</p>
          <p>ID: {authUser.id}</p>
        </div>
        <div className="space-y-2">
          <Button
            onClick={onRetryProfile}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Reintentar Cargar Perfil
          </Button>
          <Button
            onClick={onForceRefresh}
            className="w-full bg-info text-info-foreground hover:bg-info/90"
          >
            Forzar Refresco de Perfil
          </Button>
          <Button
            onClick={onCleanupAndRestart}
            variant="outline"
            className="w-full bg-auth-surface/90 text-auth-input-foreground border-auth-input-border"
          >
            Limpiar Sesión y Reiniciar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
