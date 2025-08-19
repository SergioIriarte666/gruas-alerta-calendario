
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
    <Card className="border border-gray-200 w-[400px] bg-white/95 backdrop-blur-sm shadow-xl">
      <CardHeader>
        <CardTitle className="text-black">Error de Perfil</CardTitle>
        <CardDescription className="text-red-600">{profileError}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 bg-transparent">
        <div className="text-sm text-gray-600">
          <p>Usuario autenticado: {authUser.email}</p>
          <p>ID: {authUser.id}</p>
        </div>
        <div className="space-y-2">
          <Button
            onClick={onRetryProfile}
            className="w-full bg-tms-green hover:bg-tms-green-dark text-black"
          >
            Reintentar Cargar Perfil
          </Button>
          <Button
            onClick={onForceRefresh}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            Forzar Refresco de Perfil
          </Button>
          <Button
            onClick={onCleanupAndRestart}
            variant="outline"
            className="w-full bg-white/90 text-black border-gray-300"
          >
            Limpiar Sesión y Reiniciar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
