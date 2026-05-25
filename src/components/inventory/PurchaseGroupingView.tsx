import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Package, 
  Search, 
  ChevronDown, 
  ChevronRight, 
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Calendar,
  FileText
} from 'lucide-react';
import { useInventoryMovements, type InventoryMovement } from '@/hooks/useInventory';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PurchaseGroup {
  document: string;
  movements: InventoryMovement[];
  totalCost: number;
  totalItems: number;
  supplier: string | null;
  date: Date;
  hasDiscrepancy: boolean;
}

export const PurchaseGroupingView = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  const { data: movements = [], isLoading } = useInventoryMovements(500);

  // Group movements by reference document
  const purchaseGroups = useMemo(() => {
    const groupedMovements = movements
      .filter(movement => 
        movement.reference_document && 
        movement.movement_type === 'entry' &&
        movement.status === 'active'
      )
      .reduce((groups, movement) => {
        const doc = movement.reference_document!;
        if (!groups[doc]) {
          groups[doc] = [];
        }
        groups[doc].push(movement);
        return groups;
      }, {} as Record<string, InventoryMovement[]>);

    return Object.entries(groupedMovements)
      .map(([document, movs]) => {
        const totalCost = movs.reduce((sum, m) => sum + (m.total_cost || 0), 0);
        const supplier = movs.find(m => m.supplier_name)?.supplier_name || null;
        const firstDate = movs.reduce((earliest, m) => {
          const movDate = new Date(m.movement_date);
          return movDate < earliest ? movDate : earliest;
        }, new Date(movs[0].movement_date));

        // Check for discrepancies (could be enhanced with actual invoice totals)
        const hasDiscrepancy = false; // Placeholder for future invoice reconciliation

        return {
          document,
          movements: movs.sort((a, b) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime()),
          totalCost,
          totalItems: movs.length,
          supplier,
          date: firstDate,
          hasDiscrepancy
        } as PurchaseGroup;
      })
      .filter(group => 
        !searchTerm.trim() || 
        group.document.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (group.supplier && group.supplier.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [movements, searchTerm]);

  const toggleGroup = (document: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(document)) {
      newExpanded.delete(document);
    } else {
      newExpanded.add(document);
    }
    setExpandedGroups(newExpanded);
  };

  const expandAll = () => {
    setExpandedGroups(new Set(purchaseGroups.map(g => g.document)));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8 text-muted-foreground">
            Cargando compras agrupadas...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="size-5" />
            Compras Agrupadas por Documento
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
              <Input
                placeholder="Buscar por documento o proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expandir Todo
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Contraer Todo
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <div>
                <div className="text-2xl font-bold">{purchaseGroups.length}</div>
                <div className="text-sm text-muted-foreground">Documentos únicos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-green-600" />
              <div>
                <div className="text-2xl font-bold">
                  {purchaseGroups.reduce((sum, g) => sum + g.totalItems, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Productos totales</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="size-4 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">
                  ${purchaseGroups.reduce((sum, g) => sum + g.totalCost, 0).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Valor total</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grouped Purchases */}
      <div className="space-y-2">
        {purchaseGroups.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Package className="size-12 mx-auto mb-4 opacity-50" />
              <p>No se encontraron compras agrupadas</p>
              <p className="text-sm mt-2">
                Asegúrese de usar el campo "Documento de Referencia" al registrar entradas de inventario
              </p>
            </CardContent>
          </Card>
        ) : (
          purchaseGroups.map((group) => (
            <Collapsible
              key={group.document}
              open={expandedGroups.has(group.document)}
              onOpenChange={() => toggleGroup(group.document)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expandedGroups.has(group.document) ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                              {group.document}
                            </code>
                            {group.hasDiscrepancy && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="size-3 mr-1" />
                                Discrepancia
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {group.supplier && (
                              <span className="mr-4">Proveedor: {group.supplier}</span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3" />
                              {format(group.date, 'dd/MM/yyyy', { locale: es })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">
                          ${group.totalCost.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {group.totalItems} producto{group.totalItems !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Costo Unit.</TableHead>
                          <TableHead>Costo Total</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Lote</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.movements.map((movement) => (
                          <TableRow key={movement.id}>
                            <TableCell>
                              <div className="font-medium">{movement.item?.name}</div>
                              {movement.item?.sku && (
                                <div className="text-sm text-muted-foreground">
                                  SKU: {movement.item.sku}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">{movement.quantity}</span>
                                <span className="text-sm text-muted-foreground">
                                  {movement.item?.unit_of_measure || 'unidades'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {movement.unit_cost ? (
                                <span>${movement.unit_cost.toLocaleString()}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {movement.total_cost ? (
                                <span className="font-medium">
                                  ${movement.total_cost.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {format(new Date(movement.movement_date), 'dd/MM/yy HH:mm')}
                              </div>
                            </TableCell>
                            <TableCell>
                              {movement.batch_number ? (
                                <code className="text-xs bg-muted px-1 rounded">
                                  {movement.batch_number}
                                </code>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))
        )}
      </div>
    </div>
  );
};