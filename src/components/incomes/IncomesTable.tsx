import { useState } from 'react';
import { Edit2, Trash2, ArrowUpDown, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { IncomeWithDetails } from '@/types/incomes';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from '@/hooks/use-mobile';

interface IncomesTableProps {
  incomes: IncomeWithDetails[];
  onEdit: (income: IncomeWithDetails) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
}

type SortField = 'income_date' | 'amount' | 'category' | 'client';
type SortOrder = 'asc' | 'desc';

export const IncomesTable = ({ incomes, onEdit, onDelete, isLoading }: IncomesTableProps) => {
  const [sortField, setSortField] = useState<SortField>('income_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedIncomes = [...incomes].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'income_date':
        comparison = new Date(a.income_date).getTime() - new Date(b.income_date).getTime();
        break;
      case 'amount':
        comparison = a.amount - b.amount;
        break;
      case 'category':
        comparison = (a.category?.name || '').localeCompare(b.category?.name || '');
        break;
      case 'client':
        comparison = (a.client?.name || '').localeCompare(b.client?.name || '');
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  if (isLoading) {
    return (
      <div className="bg-card border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">Cargando ingresos...</p>
      </div>
    );
  }

  if (incomes.length === 0) {
    return (
      <div className="bg-card border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">No hay ingresos registrados</p>
      </div>
    );
  }

  const deleteDialog = (
    <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar ingreso?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. El ingreso será eliminado permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (deleteId) {
                onDelete(deleteId);
                setDeleteId(null);
              }
            }}
            className="bg-destructive hover:bg-destructive/90"
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isMobile) {
    return (
      <>
        <div className="space-y-3">
          {sortedIncomes.map((income) => (
            <Card key={income.id} className="bg-card border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="font-medium text-foreground text-sm truncate">{income.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatForDisplay(parseFromDatabase(income.income_date))}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-green-600 shrink-0 ml-2">
                    ${income.amount.toLocaleString('es-CL', { minimumFractionDigits: 0 })}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {income.category && (
                    <Badge style={{ backgroundColor: income.category.color + '20', color: income.category.color }} className="text-xs">
                      {income.category.name}
                    </Badge>
                  )}
                  {income.occasional_client_name ? (
                    <span className="text-xs text-muted-foreground">{income.occasional_client_name} (Ocasional)</span>
                  ) : income.client?.name ? (
                    <span className="text-xs text-muted-foreground">{income.client.name}</span>
                  ) : null}
                  {income.invoice && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <FileText className="h-3 w-3" />
                      {income.invoice.numero_fiscal || income.invoice.folio}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t">
                  <span className="text-xs text-muted-foreground capitalize">{income.payment_method.replace('_', ' ')}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(income)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(income.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {deleteDialog}
      </>
    );
  }

  return (
    <>
      <div className="bg-card border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('income_date')} className="flex items-center gap-1">
                  Fecha <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('category')} className="flex items-center gap-1">
                  Categoría <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('client')} className="flex items-center gap-1">
                  Cliente <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>Factura</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Referencia</TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" onClick={() => handleSort('amount')} className="flex items-center gap-1 ml-auto">
                  Monto <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedIncomes.map((income) => (
              <TableRow key={income.id} className="hover:bg-muted/50">
                <TableCell className="font-medium">
                  {formatForDisplay(parseFromDatabase(income.income_date))}
                </TableCell>
                <TableCell className="max-w-xs truncate">{income.description}</TableCell>
                <TableCell>
                  {income.category && (
                    <Badge style={{ backgroundColor: income.category.color + '20', color: income.category.color }}>
                      {income.category.name}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {income.occasional_client_name ? (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-xs">(Ocasional)</span>
                      <span>{income.occasional_client_name}</span>
                    </div>
                  ) : income.client?.name ? (
                    <span>{income.client.name}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {income.invoice ? (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{income.invoice.numero_fiscal || income.invoice.folio}</span>
                        <span className="text-xs text-muted-foreground">${income.invoice.total.toLocaleString()}</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell className="capitalize">{income.payment_method.replace('_', ' ')}</TableCell>
                <TableCell>{income.bank_reference || '-'}</TableCell>
                <TableCell className="text-right font-semibold text-green-600">
                  ${income.amount.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(income)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(income.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {deleteDialog}
    </>
  );
};
