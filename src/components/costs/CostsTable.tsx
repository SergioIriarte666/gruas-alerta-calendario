
import React from 'react';
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
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { Cost } from '@/types/costs';
import { useDeleteCost } from '@/hooks/useCosts';
import { Card, CardContent } from '@/components/ui/card';

interface CostsTableProps {
    costs: Cost[];
    onEdit: (cost: Cost) => void;
}

export const CostsTable = ({ costs, onEdit }: CostsTableProps) => {
    const { mutate: deleteCost } = useDeleteCost();

    const handleDelete = (id: string) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar este costo?')) {
            deleteCost(id);
        }
    };
    
    const getAssociatedTo = (cost: Cost) => {
        if (cost.cranes) return `Grúa: ${cost.cranes.brand} ${cost.cranes.model}`;
        if (cost.operators) return `Operador: ${cost.operators.name}`;
        if (cost.services) return `Servicio: ${cost.services.folio}`;
        return 'N/A';
    }

    return (
        <Card className="bg-white/10 border-white/20">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="border-white/20 hover:bg-transparent">
                            <TableHead className="text-white">Fecha</TableHead>
                            <TableHead className="text-white">Descripción</TableHead>
                            <TableHead className="text-white">Categoría</TableHead>
                            <TableHead className="text-white text-right">Monto</TableHead>
                            <TableHead className="text-white">Asociado a</TableHead>
                            <TableHead className="text-right text-white">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {costs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                                    No se han registrado costos.
                                </TableCell>
                            </TableRow>
                        ) : (
                            costs.map((cost) => (
                                <TableRow key={cost.id} className="border-white/20">
                                    <TableCell className="text-white">{new Date(cost.date + 'T00:00:00').toLocaleDateString()}</TableCell>
                                    <TableCell className="text-white font-medium">{cost.description}</TableCell>
                                    <TableCell className="text-gray-300">{cost.cost_categories.name}</TableCell>
                                    <TableCell className="text-white text-right">${Number(cost.amount).toLocaleString('es-CL')}</TableCell>
                                    <TableCell className="text-gray-300">{getAssociatedTo(cost)}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0 text-white hover:bg-white/20 hover:text-white">
                                                    <span className="sr-only">Abrir menú</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => onEdit(cost)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    <span>Editar</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDelete(cost.id)} className="text-red-500 focus:text-red-400 focus:bg-red-800/50">
                                                    <Trash2 className="mr-2 h-4 w-4" />
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
    );
};
