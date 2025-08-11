
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Trash2 } from 'lucide-react';

interface LogoPreviewProps {
  currentLogo: string;
  onRemove: () => void;
  onChangeClick: () => void;
  disabled?: boolean;
}

export const LogoPreview: React.FC<LogoPreviewProps> = ({
  currentLogo,
  onRemove,
  onChangeClick,
  disabled
}) => {
  return (
    <Card className="glass-card">
      <CardContent className="p-4">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center">
            <img
              src={currentLogo}
              alt="Company Logo"
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <div className="flex-1">
            <p className="text-white text-sm">Logotipo actual</p>
            <p className="text-gray-400 text-xs">Se muestra en informes y facturas</p>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onChangeClick}
              disabled={disabled}
              className="border-gray-700 text-gray-300"
            >
              <Upload className="w-4 h-4 mr-2" />
              Cambiar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onRemove}
              disabled={disabled}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
