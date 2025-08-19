
import React from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

interface SettingsHeaderProps {
  onReset: () => void;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({ onReset }) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-black">Configuración del Sistema</h1>
        <p className="text-gray-600 mt-2">
          Gestiona la configuración de la empresa, usuarios y sistema
        </p>
      </div>
      <div className="flex space-x-2">
        <Button
          variant="outline"
          onClick={onReset}
          className="border-gray-300 text-black hover:bg-gray-50"
          title="Restablecer la configuración a los valores por defecto"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Restablecer
        </Button>
      </div>
    </div>
  );
};
