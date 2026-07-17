import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, FileCheck2 } from 'lucide-react';
import { formatBusinessDateLong } from '@/utils/timezoneUtils';
import type { ExternalServiceListItem } from '@/hooks/useExternalServices';

interface Props {
  services: ExternalServiceListItem[];
  onSelect: (svc: ExternalServiceListItem) => void;
}

const formatCurrency = (amount: number | null) => {
  if (!amount) return '—';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const ExternalServicesTable = ({ services, onSelect }: Props) => {
  return (
    <div className="external-services-panel overflow-hidden">
      <Table>
        <TableHeader className="external-services-table-head">
          <TableRow className="border-border hover:bg-muted/50">
            <TableHead>Folio</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Vehículo</TableHead>
            <TableHead>Costo subc.</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((s) => (
            <TableRow
              key={s.id}
              className="cursor-pointer border-border hover:bg-muted/50"
              onClick={() => onSelect(s)}
            >
              <TableCell className="font-mono text-sm font-medium">{s.folio}</TableCell>
              <TableCell className="text-sm">{s.serviceTypeName}</TableCell>
              <TableCell className="text-sm">{formatBusinessDateLong(s.serviceDate)}</TableCell>
              <TableCell className="text-sm">{s.clientName ?? '—'}</TableCell>
              <TableCell className="text-sm">
                {s.vehicleBrand ? `${s.vehicleBrand} ${s.vehicleModel ?? ''} (${s.licensePlate ?? 'S/P'})` : '—'}
              </TableCell>
              <TableCell className="text-sm">{formatCurrency(s.outsourcedCost)}</TableCell>
              <TableCell>
                {s.hasClosure ? (
                  <Badge className="border-success/30 bg-success/10 text-success">
                    Cerrado
                  </Badge>
                ) : (
                  <Badge className="border-warning/30 bg-warning/10 text-warning">
                    Pendiente
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(s);
                  }}
                  className={
                    s.hasClosure
                      ? 'border-info/30 text-info hover:bg-info/10'
                      : 'external-services-primary-action'
                  }
                >
                  {s.hasClosure ? (
                    <>
                      <Eye className="mr-1 size-3.5" />
                      Ver
                    </>
                  ) : (
                    <>
                      <FileCheck2 className="mr-1 size-3.5" />
                      Cerrar
                    </>
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
