import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package, Wrench, ChevronDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface InventoryMovement {
  id: string;
  movement_date: string;
  movement_type: string;
  quantity: number;
  total_cost: number | null;
  reference_document: string | null;
  inventory_items: {
    name: string;
    sku: string | null;
    unit_of_measure: string;
  } | null;
  inventory_locations: {
    name: string;
  } | null;
}

interface CranePart {
  id: string;
  date: string;
  part_name: string;
  quantity: number;
  unit_price: number;
  total_value: number | null;
  notes: string | null;
  cranes: {
    license_plate: string;
    brand: string;
    model: string;
  } | null;
}

interface SupplierInventoryAndPartsTabProps {
  movements: InventoryMovement[];
  parts: CranePart[];
  isLoading: boolean;
}

const getMovementTypeLabel = (type: string) => {
  switch (type) {
    case 'entry': return 'Entrada';
    case 'exit': return 'Salida';
    case 'adjustment': return 'Ajuste';
    case 'transfer': return 'Transferencia';
    default: return type;
  }
};

const getMovementTypeColor = (type: string) => {
  switch (type) {
    case 'entry': return 'bg-green-600 text-white';
    case 'exit': return 'bg-red-600 text-white';
    case 'adjustment': return 'bg-yellow-600 text-white';
    case 'transfer': return 'bg-blue-600 text-white';
    default: return 'bg-muted text-muted-foreground';
  }
};

export const SupplierInventoryAndPartsTab: React.FC<SupplierInventoryAndPartsTabProps> = ({ movements, parts, isLoading }) => {
  const [inventoryOpen, setInventoryOpen] = useState(true);
  const [partsOpen, setPartsOpen] = useState(true);
  const [searchMovements, setSearchMovements] = useState('');
  const [searchParts, setSearchParts] = useState('');

  const filteredMovements = useMemo(() => {
    if (!searchMovements) return movements;
    const term = searchMovements.toLowerCase();
    return movements.filter(m =>
      m.inventory_items?.name?.toLowerCase().includes(term) ||
      m.reference_document?.toLowerCase().includes(term)
    );
  }, [movements, searchMovements]);

  const filteredParts = useMemo(() => {
    if (!searchParts) return parts;
    const term = searchParts.toLowerCase();
    return parts.filter(p =>
      p.part_name.toLowerCase().includes(term) ||
      p.cranes?.license_plate?.toLowerCase().includes(term)
    );
  }, [parts, searchParts]);

  const totalMovementsCost = useMemo(() =>
    movements.reduce((sum, m) => sum + (m.total_cost || 0), 0),
    [movements]
  );

  const totalPartsCost = useMemo(() =>
    parts.reduce((sum, p) => sum + (p.total_value || p.quantity * p.unit_price), 0),
    [parts]
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Inventory Movements Section */}
      <Collapsible open={inventoryOpen} onOpenChange={setInventoryOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground text-sm">
              Movimientos de Inventario ({movements.length})
            </span>
            {totalMovementsCost > 0 && (
              <Badge variant="outline" className="text-xs font-bold text-violet-600 border-violet-300">
                {formatCurrency(totalMovementsCost)}
              </Badge>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${inventoryOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          {movements.length > 3 && (
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar artículo o documento..."
                value={searchMovements}
                onChange={(e) => setSearchMovements(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          )}
          {movements.length === 0 ? (
            <div className="text-center py-6">
              <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Sin movimientos de inventario</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground text-xs">Fecha</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Tipo</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Artículo</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Ubicación</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-right">Cant.</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-right">Costo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.map((movement) => (
                    <TableRow key={movement.id} className="border-border">
                      <TableCell className="text-foreground text-sm">
                        {format(new Date(movement.movement_date), 'dd/MM/yy', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getMovementTypeColor(movement.movement_type)} text-xs`}>
                          {getMovementTypeLabel(movement.movement_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-foreground text-sm">
                        {movement.inventory_items?.name || '-'}
                      </TableCell>
                      <TableCell className="text-foreground text-sm">
                        {movement.inventory_locations?.name || '-'}
                      </TableCell>
                      <TableCell className="text-right text-foreground text-sm">
                        {movement.quantity}
                      </TableCell>
                      <TableCell className="text-right font-bold text-violet-600 text-sm">
                        {movement.total_cost ? formatCurrency(movement.total_cost) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Crane Parts Section */}
      <Collapsible open={partsOpen} onOpenChange={setPartsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground text-sm">
              Piezas de Grúas ({parts.length})
            </span>
            {totalPartsCost > 0 && (
              <Badge variant="outline" className="text-xs font-bold text-violet-600 border-violet-300">
                {formatCurrency(totalPartsCost)}
              </Badge>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${partsOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          {parts.length > 3 && (
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pieza o patente..."
                value={searchParts}
                onChange={(e) => setSearchParts(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          )}
          {parts.length === 0 ? (
            <div className="text-center py-6">
              <Wrench className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Sin piezas registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground text-xs">Fecha</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Grúa</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Pieza</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-right">Cant.</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-right">P. Unit.</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParts.map((part) => (
                    <TableRow key={part.id} className="border-border">
                      <TableCell className="text-foreground text-sm">
                        {format(new Date(part.date), 'dd/MM/yy', { locale: es })}
                      </TableCell>
                      <TableCell className="text-foreground text-sm">
                        {part.cranes ? (
                          <span title={`${part.cranes.brand} ${part.cranes.model}`}>
                            {part.cranes.license_plate}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="font-medium text-foreground text-sm">
                        {part.part_name}
                      </TableCell>
                      <TableCell className="text-right text-foreground text-sm">
                        {part.quantity}
                      </TableCell>
                      <TableCell className="text-right text-foreground text-sm">
                        {formatCurrency(part.unit_price)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-violet-600 text-sm">
                        {formatCurrency(part.total_value || part.quantity * part.unit_price)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Grand Total */}
      {(totalMovementsCost > 0 || totalPartsCost > 0) && (
        <div className="flex items-center justify-end gap-4 pt-3 border-t border-border">
          <span className="text-sm text-muted-foreground">Total General:</span>
          <span className="text-lg font-bold text-violet-600">
            {formatCurrency(totalMovementsCost + totalPartsCost)}
          </span>
        </div>
      )}
    </div>
  );
};
