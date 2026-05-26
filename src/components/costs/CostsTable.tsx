import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash2, Eye, CheckCircle, Circle, CalendarClock } from 'lucide-react';
import { format } from 'date-fns';
import { Cost } from '@/types/costs';
import { Card, CardContent } from '@/components/ui/card';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useState } from 'react';

interface CostsTableProps {
    costs: Cost[];
    onEdit: (cost: Cost) => void;
    onViewDetails: (cost: Cost) => void;
    onDelete: (cost: Cost) => void;
}

export const CostsTable = ({ costs, onEdit, onViewDetails, onDelete }: CostsTableProps) => {
    const [costToDelete, setCostToDelete] = useState<Cost | null>(null);
    
    const getAssociatedTo = (cost: Cost) => {
        if (cost.cranes) return `Grúa: ${cost.cranes.brand} ${cost.cranes.model} (${cost.cranes.license_plate})`;
        if (cost.operators) return `Operador: ${cost.operators.name}`;
        if (cost.services) return `Servicio: ${cost.services.folio}`;
        return 'N/A';
    }

    const getCategoryDisplay = (cost: Cost) => {
        const categoryName = cost.cost_categories?.name || 'Sin categoría';
        if (cost.subcategory && categoryName === 'Gastos de Servicios') {
            return `${categoryName} - ${cost.subcategory}`;
        }
        return categoryName;
    }

    return (
        <>
        <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="border-border/70 hover:bg-transparent">
                            <TableHead>Fecha</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead className="text-center">Pagado</TableHead>
                            <TableHead>Asociado a</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {costs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                                    No se han registrado costos.
                                </TableCell>
                            </TableRow>
                        ) : (
                            costs.map((cost) => (
                                <TableRow key={cost.id} className="border-border/70">
                                    <TableCell className="text-foreground">
                                        {cost.cost_categories?.name === 'Comisión Operador' && cost.payment_date 
                                            ? formatForDisplay(parseFromDatabase(cost.payment_date))
                                            : formatForDisplay(parseFromDatabase(cost.date))
                                        }
                                    </TableCell>
                                    <TableCell className="font-medium text-foreground">{cost.description}</TableCell>
                                    <TableCell className="text-muted-foreground">{getCategoryDisplay(cost)}</TableCell>
                                    <TableCell className="text-right text-foreground">${Number(cost.amount).toLocaleString('es-CL')}</TableCell>
                                    <TableCell className="text-center">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    {cost.payment_date ? (
                                                        new Date(cost.payment_date + 'T00:00:00') > new Date() ? (
                                                            <CalendarClock className="mx-auto size-5 text-warning" />
                                                        ) : (
                                                            <CheckCircle className="mx-auto size-5 text-success" />
                                                        )
                                                    ) : (
                                                        <Circle className="mx-auto size-5 text-danger" />
                                                    )}
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {cost.payment_date
                                                        ? new Date(cost.payment_date + 'T00:00:00') > new Date()
                                                            ? `Pago programado - ${format(new Date(cost.payment_date + 'T00:00:00'), 'dd/MM/yyyy')}`
                                                            : 'Pagado'
                                                        : 'Pendiente'}
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{getAssociatedTo(cost)}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="size-8 p-0">
                                                    <span className="sr-only">Abrir menú</span>
                                                    <MoreHorizontal className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => onViewDetails(cost)}>
                                                    <Eye className="mr-2 size-4" />
                                                    <span>Ver Detalles</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onEdit(cost)}>
                                                    <Edit className="mr-2 size-4" />
                                                    <span>Editar</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setCostToDelete(cost)} className="text-destructive focus:text-destructive">
                                                    <Trash2 className="mr-2 size-4" />
                                                    <span>Eliminar</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        <AlertDialog open={!!costToDelete} onOpenChange={(open) => !open && setCostToDelete(null)}>
            <AlertDialogContent className="border-border/70 bg-card">
                <AlertDialogHeader>
                    <AlertDialogTitle>Eliminar costo</AlertDialogTitle>
                    <AlertDialogDescription>
                        {costToDelete
                            ? `Se eliminará "${costToDelete.description}" por ${Number(costToDelete.amount).toLocaleString('es-CL')} CLP.`
                            : 'Esta acción no se puede deshacer.'}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-danger text-danger-foreground hover:bg-danger/90"
                        onClick={() => {
                            if (!costToDelete) return;
                            onDelete(costToDelete);
                            setCostToDelete(null);
                        }}
                    >
                        Eliminar
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
};
