import React from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface SettingsHeaderProps {
  onReset: () => void;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({ onReset }) => {
  const isMobile = useIsMobile();
  
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <span className="dashboard-section-kicker"><SlidersHorizontal className="size-3.5" />Administración central</span>
        <h1 className="dashboard-section-title">Configuración del Sistema</h1>
        <p className="dashboard-section-description">Ajustes organizados por experiencia, operación, acceso e integridad.</p>
      </div>
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
    </div>
  );
};
