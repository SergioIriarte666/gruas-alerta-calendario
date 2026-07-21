import { useMemo } from 'react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, FileCheck2, FileWarning } from 'lucide-react';
import { formatForDisplay, parseFromDatabase, formatDateForDisplay } from '@/utils/timezoneUtils';
import { ServicioConFotos } from '@/types/regenerar-inspeccion';

interface RegenerarInspeccionTableProps {
  servicios: ServicioConFotos[];
  onPreview: (servicio: ServicioConFotos) => void;
}

export const RegenerarInspeccionTable = ({ servicios, onPreview }: RegenerarInspeccionTableProps) => {
  const columns = useMemo<ColumnDef<ServicioConFotos>[]>(() => [
    {
      accessorKey: 'folio',
      header: 'Folio',
      cell: ({ row }) => <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">#{row.original.folio}</Badge>,
    },
    {
      accessorKey: 'serviceDate',
      header: 'Fecha',
      cell: ({ row }) => formatForDisplay(parseFromDatabase(row.original.serviceDate)),
    },
    {
      accessorKey: 'clientName',
      header: 'Cliente',
      cell: ({ row }) => <span className="font-medium">{row.original.clientName}</span>,
    },
    {
      accessorKey: 'operatorName',
      header: 'Operador',
    },
    {
      accessorKey: 'fotosDisponibles',
      header: 'Fotos',
      cell: ({ row }) => <Badge variant="secondary">{row.original.fotosDisponibles}</Badge>,
    },
    {
      id: 'pdf',
      header: 'Estado PDF',
      cell: ({ row }) => {
        const hasPdf = Boolean(row.original.pdfUrlActual || row.original.pdfRetiroUrlActual);
        return hasPdf ? (
          <span className="inline-flex items-center gap-1 text-sm text-success">
            <FileCheck2 className="size-4" />
            Disponible
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm text-warning-text">
            <FileWarning className="size-4" />
            Sin PDF
          </span>
        );
      },
    },
    {
      accessorKey: 'ultimoEnvioWhatsappAt',
      header: 'Último envío',
      cell: ({ row }) => row.original.ultimoEnvioWhatsappAt
        ? formatDateForDisplay(row.original.ultimoEnvioWhatsappAt)
        : 'Sin envío',
    },
    {
      id: 'acciones',
      header: 'Acciones',
      cell: ({ row }) => (
        <Button size="sm" onClick={() => onPreview(row.original)}>
          <Eye className="mr-2 size-4" />
          Previsualizar
        </Button>
      ),
    },
  ], [onPreview]);

  const table = useReactTable({
    data: servicios,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (servicios.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        No hay servicios con fotos que coincidan con los filtros.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
