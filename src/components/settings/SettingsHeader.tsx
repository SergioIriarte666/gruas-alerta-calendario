import React from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { RotateCcw } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface SettingsHeaderProps {
  onReset: () => void;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({ onReset }) => {
  const isMobile = useIsMobile();
  
  return (
    <PageHeader
      title="Configuración del Sistema"
      description="Gestiona empresa, usuarios, respaldos, integridad y comportamiento global del sistema."
      actions={
        <Button
          variant="outline"
          size={isMobile ? "sm" : "default"}
          onClick={onReset}
          title="Restablecer la configuración a los valores por defecto"
          className="border-border/70 bg-card/70"
        >
          <RotateCcw className="size-4 mr-2" />
          {isMobile ? "Reset" : "Restablecer"}
        </Button>
      }
    />
  );
};
