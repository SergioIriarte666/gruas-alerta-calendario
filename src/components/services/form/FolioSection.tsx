
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FolioSectionProps {
  folio: string;
  onFolioChange: (folio: string) => void;
  isManualFolio: boolean;
  onManualFolioChange: (isManual: boolean) => void;
  onGenerateNewFolio: () => void;
  isEditing: boolean;
  isLoading: boolean;
}

export const FolioSection = ({
  folio,
  onFolioChange,
  isManualFolio,
  onManualFolioChange,
  onGenerateNewFolio,
  isEditing,
  isLoading
}: FolioSectionProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="folio">Folio del Servicio</Label>
        <div className="flex items-center space-x-2">
          <Label htmlFor="manual-folio" className="text-sm">Manual</Label>
          <Switch
            id="manual-folio"
            checked={isManualFolio}
            onCheckedChange={onManualFolioChange}
            disabled={isEditing}
            className="data-[state=checked]:bg-amber-500"
          />
        </div>
      </div>
      <div className="flex space-x-2">
        <Input
          id="folio"
          value={folio}
          onChange={(e) => onFolioChange(e.target.value)}
          placeholder="Ej: SRV-001"
          required
          disabled={!isManualFolio && !isEditing}
          className="flex-1"
        />
        {!isManualFolio && !isEditing && (
          <Button
            type="button"
            variant="outline"
            onClick={onGenerateNewFolio}
            disabled={isLoading}
            title="Generar nuevo folio"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </Button>
        )}
      </div>
      {!isManualFolio && !isEditing && (
        <p className="text-xs text-gray-600">
          El folio se genera automáticamente usando el formato configurado de la empresa.
        </p>
      )}
    </div>
  );
};
