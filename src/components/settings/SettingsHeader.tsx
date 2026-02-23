
import React from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface SettingsHeaderProps {
  onReset: () => void;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({ onReset }) => {
  const isMobile = useIsMobile();
  
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div>
        <h1 className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold text-foreground`}>
          Configuración del Sistema
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Gestiona la configuración de la empresa, usuarios y sistema
        </p>
      </div>
      <Button
        variant="outline"
        size={isMobile ? "sm" : "default"}
        onClick={onReset}
        title="Restablecer la configuración a los valores por defecto"
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        {isMobile ? "Reset" : "Restablecer"}
      </Button>
    </div>
  );
};
