
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Database, 
  RefreshCw, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useMigrateLegacyCranePartsData, useDetectDuplicateParts } from '@/hooks/useCranePartsDataMigration';
import { Crane } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface CranePartsDataMigrationProps {
  crane?: Crane;
}

export const CranePartsDataMigration = ({ crane }: CranePartsDataMigrationProps) => {
  const [showMigrationTools, setShowMigrationTools] = useState(false);
  
  const migrateMutation = useMigrateLegacyCranePartsData();
  const detectDuplicatesMutation = useDetectDuplicateParts();

  const handleMigrateLegacyData = () => {
    migrateMutation.mutate(crane?.id);
  };

  const handleDetectDuplicates = () => {
    detectDuplicatesMutation.mutate(crane?.id);
  };

  if (!showMigrationTools) {
    return (
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMigrationTools(true)}
          className="border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/10"
        >
          <Database className="w-3 h-3 mr-1" />
          Herramientas de Datos
        </Button>
      </div>
    );
  }

  return (
    <Card className="bg-yellow-500/10 border-yellow-500/30">
      <CardHeader>
        <CardTitle className="text-yellow-300 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Herramientas de Migración y Limpieza de Datos
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMigrationTools(false)}
            className="ml-auto text-gray-400 hover:text-white"
          >
            ×
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Detección de Duplicados */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-400" />
              <span className="text-white font-medium">Detectar Duplicados</span>
            </div>
            <p className="text-sm text-gray-300">
              Analiza si existen registros duplicados entre piezas y costos.
            </p>
            <Button
              onClick={handleDetectDuplicates}
              disabled={detectDuplicatesMutation.isPending}
              variant="outline"
              size="sm"
              className="border-orange-500/50 text-orange-300 hover:bg-orange-500/10"
            >
              {detectDuplicatesMutation.isPending ? (
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <AlertCircle className="w-3 h-3 mr-1" />
              )}
              Analizar Duplicados
            </Button>
          </div>

          {/* Migración de Datos Legacy */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-white font-medium">Migrar Datos Legacy</span>
            </div>
            <p className="text-sm text-gray-300">
              Vincula costos históricos de piezas con registros de crane_parts.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={migrateMutation.isPending}
                  variant="outline"
                  size="sm"
                  className="border-green-500/50 text-green-300 hover:bg-green-500/10"
                >
                  {migrateMutation.isPending ? (
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Database className="w-3 h-3 mr-1" />
                  )}
                  Migrar Datos
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-black border-yellow-500/30">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-yellow-300">
                    ¿Migrar datos legacy?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-300">
                    Esta acción creará registros en crane_parts para costos de "Piezas y Repuestos" 
                    que no estén vinculados. {crane ? `Solo se procesarán datos de la grúa ${crane.licensePlate}.` : 'Se procesarán todas las grúas.'}
                    <br /><br />
                    <strong>Nota:</strong> Esta operación es segura y no eliminará datos existentes.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-gray-600 text-gray-300 hover:bg-gray-700">
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleMigrateLegacyData}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    Migrar Datos
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="border-t border-yellow-500/30 pt-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />
            <div className="text-xs text-gray-400">
              <p><strong>Recomendaciones:</strong></p>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li>Ejecute "Detectar Duplicados" primero para entender el estado actual</li>
                <li>Realice una copia de seguridad antes de ejecutar migraciones</li>
                <li>La migración procesará solo registros que no estén vinculados</li>
                <li>Después de la migración, los duplicados deberían desaparecer automáticamente</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
