
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
        <div className="flex items-center gap-x-4">
          <div className="flex size-16 items-center justify-center overflow-hidden rounded-lg bg-muted">
            <img
              src={currentLogo}
              alt="Company Logo"
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <div className="flex-1">
            <p className="text-sm text-foreground">Logotipo actual</p>
            <p className="text-xs text-muted-foreground">Se muestra en informes y facturas</p>
          </div>
          <div className="flex gap-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onChangeClick}
              disabled={disabled}
              className="border-border text-foreground"
            >
              <Upload className="size-4 mr-2" />
              Cambiar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onRemove}
              disabled={disabled}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
