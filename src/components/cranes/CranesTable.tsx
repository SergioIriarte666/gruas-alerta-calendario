
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Eye, Plus, Truck } from 'lucide-react';
import { Crane } from '@/types';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { useDeviceType } from '@/hooks/useDeviceType';
import { CranesMobileView } from './CranesMobileView';

interface CranesTableProps {
  cranes: Crane[];
  totalCranes: number;
  onEdit: (crane: Crane) => void;
  onDelete: (crane: Crane) => void;
  onToggleStatus: (crane: Crane) => void;
  onViewDetails: (crane: Crane) => void;
  onNewCrane: () => void;
  searchTerm: string;
}

export const CranesTable = ({
  cranes,
  totalCranes,
  onEdit,
  onDelete,
  onToggleStatus,
  onViewDetails,
  onNewCrane,
  searchTerm,
}: CranesTableProps) => {
  const { isMobile } = useDeviceType();

  // Render mobile view if on mobile device
  if (isMobile) {
    return (
      <CranesMobileView
        cranes={cranes}
        totalCranes={totalCranes}
        onEdit={onEdit}
        onDelete={onDelete}
        onViewDetails={onViewDetails}
        onNewCrane={onNewCrane}
        searchTerm={searchTerm}
      />
    );
  }

  // Desktop view (unchanged functionality)
  if (cranes.length === 0 && searchTerm) {
    return (
      <Card className="bg-card border-border cranes-scope">
        <CardContent className="p-8 text-center">
          <Truck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No se encontraron grúas</h3>
          <p className="text-muted-foreground mb-4">
            No hay grúas que coincidan con "{searchTerm}"
          </p>
          <Button onClick={onNewCrane} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Grúa
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (cranes.length === 0) {
    return (
      <Card className="bg-card border-border cranes-scope">
        <CardContent className="p-8 text-center">
          <Truck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No hay grúas registradas</h3>
          <p className="text-muted-foreground mb-4">
            Comienza agregando tu primera grúa al sistema
          </p>
          <Button onClick={onNewCrane} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Primera Grúa
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border cranes-scope">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center justify-between">
          <span>Grúas Registradas ({totalCranes})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium text-foreground">Patente</th>
                <th className="text-left py-3 px-4 font-medium text-foreground">Marca/Modelo</th>
                <th className="text-left py-3 px-4 font-medium text-foreground">Tipo</th>
                <th className="text-left py-3 px-4 font-medium text-foreground">Rev. Técnica</th>
                <th className="text-left py-3 px-4 font-medium text-foreground">Seguro</th>
                <th className="text-left py-3 px-4 font-medium text-foreground">Permiso Circ.</th>
                <th className="text-left py-3 px-4 font-medium text-foreground">Estado</th>
                <th className="text-center py-3 px-4 font-medium text-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cranes.map((crane) => (
                <tr key={crane.id} className="border-b hover:bg-accent">
                  <td className="py-3 px-4 text-foreground font-medium">{crane.licensePlate}</td>
                  <td className="py-3 px-4 text-foreground">{crane.brand} {crane.model}</td>
                  <td className="py-3 px-4 text-foreground">{crane.type}</td>
                  <td className="py-3 px-4 text-foreground">
                    {formatForDisplay(crane.technicalReviewExpiry)}
                  </td>
                  <td className="py-3 px-4 text-foreground">
                    {formatForDisplay(crane.insuranceExpiry)}
                  </td>
                  <td className="py-3 px-4 text-foreground">
                    {formatForDisplay(crane.circulationPermitExpiry)}
                  </td>
                  <td className="py-3 px-4">
                    <Badge 
                      variant={crane.isActive ? "default" : "secondary"}
                      className={crane.isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted text-muted-foreground"
                      }
                    >
                      {crane.isActive ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(crane)}
                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 border border-blue-400/50"
                        title="Ver detalles"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(crane)}
                        className="text-tms-green hover:text-tms-green/80 hover:bg-tms-green/10 border border-tms-green/50"
                        title="Editar grúa"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(crane)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10 border border-red-400/50"
                        title="Eliminar grúa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
