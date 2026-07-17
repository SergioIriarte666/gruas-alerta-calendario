import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useInventoryItems, useInventoryStock, useInventoryMovements } from '@/hooks/useInventory';
import { Package, MapPin, Plus, Minus, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { SimpleEntryForm } from './SimpleEntryForm';
import { SimpleExitForm } from './SimpleExitForm';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ProductDrawerProps {
  productId: string | null;
  open: boolean;
  onClose: () => void;
}

export const ProductDrawer: React.FC<ProductDrawerProps> = ({ productId, open, onClose }) => {
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showExitForm, setShowExitForm] = useState(false);

  const { data: items = [] } = useInventoryItems();
  const { data: allStock = [] } = useInventoryStock();
  const { data: allMovements = [] } = useInventoryMovements(50);

  const product = items.find(item => item.id === productId);
  const productStock = allStock.filter(s => s.item_id === productId);
  const recentMovements = allMovements
    .filter(m => m.item_id === productId)
    .slice(0, 10);

  const totalStock = productStock.reduce((sum, s) => sum + (s.available_quantity || 0), 0);

  if (!product) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Package className="size-5" />
              {product.name}
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* Product Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Información del Producto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {product.sku && (
                    <div>
                      <span className="text-muted-foreground">SKU:</span>
                      <p className="font-medium">{product.sku}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Unidad:</span>
                    <p className="font-medium">{product.unit_of_measure}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Costo Unitario:</span>
                    <p className="font-medium">${product.unit_cost?.toLocaleString('es-CL') || 0}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stock Mínimo:</span>
                    <p className="font-medium">{product.minimum_stock}</p>
                  </div>
                </div>
                {product.description && (
                  <div className="pt-2">
                    <span className="text-sm text-muted-foreground">Descripción:</span>
                    <p className="text-sm">{product.description}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  {product.is_critical && (
                    <Badge variant="destructive">Crítico</Badge>
                  )}
                  {product.has_expiration && (
                    <Badge variant="outline">Con Vencimiento</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Stock by Location */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <MapPin className="size-4" />
                    Stock por Ubicación
                  </span>
                  <span className="text-2xl font-bold text-primary">
                    {totalStock} {product.unit_of_measure}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {productStock.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sin stock en ninguna ubicación
                  </p>
                ) : (
                  <div className="space-y-2">
                    {productStock.map((stock) => (
                      <div
                        key={stock.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <span className="font-medium">{stock.location?.name}</span>
                        <div className="text-right">
                          <div className="font-semibold">
                            {stock.available_quantity} {product.unit_of_measure}
                          </div>
                          {stock.reserved_quantity > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {stock.reserved_quantity} reservados
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button 
                onClick={() => setShowEntryForm(true)} 
                className="flex-1 gap-2"
              >
                <Plus className="size-4" />
                Agregar Stock
              </Button>
              <Button 
                onClick={() => setShowExitForm(true)} 
                variant="destructive"
                className="flex-1 gap-2"
              >
                <Minus className="size-4" />
                Registrar Salida
              </Button>
            </div>

            {/* Recent Movements */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="size-4" />
                  Últimos Movimientos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentMovements.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay movimientos registrados
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentMovements.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell className="text-sm">
                            {format(new Date(movement.movement_date), 'dd/MM/yyyy HH:mm', { locale: es })}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={movement.movement_type === 'entry' ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {movement.movement_type === 'entry' ? (
                                <>
                                  <TrendingUp className="size-3 mr-1" />
                                  Entrada
                                </>
                              ) : (
                                <>
                                  <TrendingDown className="size-3 mr-1" />
                                  Salida
                                </>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {movement.movement_type === 'entry' ? '+' : '-'}
                            {movement.quantity} {product.unit_of_measure}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </SheetContent>
      </Sheet>

      {/* Entry Form Dialog */}
      <Dialog open={showEntryForm} onOpenChange={setShowEntryForm}>
        <DialogContent className="inventory-dialog max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar Stock - {product.name}</DialogTitle>
          </DialogHeader>
          <SimpleEntryForm onSuccess={() => {
            setShowEntryForm(false);
            onClose();
          }} />
        </DialogContent>
      </Dialog>

      {/* Exit Form Dialog */}
      <Dialog open={showExitForm} onOpenChange={setShowExitForm}>
        <DialogContent className="inventory-dialog max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Salida - {product.name}</DialogTitle>
          </DialogHeader>
          <SimpleExitForm onSuccess={() => {
            setShowExitForm(false);
            onClose();
          }} />
        </DialogContent>
      </Dialog>
    </>
  );
};
