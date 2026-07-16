import { useMemo, useState } from 'react';
import {
  type Column,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown, Eye, Link2, Loader2, MoreHorizontal, Pencil, Plus, Trash2, Unlink } from 'lucide-react';
import { AppPagination } from '@/components/shared/AppPagination';
import { LowboyLinkDialog } from '@/components/siircv/LowboyLinkDialog';
import { LowboyLinkedDetailDialog } from '@/components/siircv/LowboyLinkedDetailDialog';
import { LowboyRecordForm } from '@/components/siircv/LowboyRecordForm';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUser } from '@/contexts/UserContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSiiRcvManager, useSiiRcvPagedRecords } from '@/hooks/useSiiRcv';
import type { SiiBookType, SiiRcvRecordFormValues, SiiRcvRecordRow } from '@/types/siiRcv';
import { DOC_TYPE_NOTA_CREDITO, DOC_TYPE_NOTA_DEBITO } from '@/types/siiRcv';

const PAGE_SIZE = 25;

const formatCLP = (value: number) => new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

const docTypeBadge = (docType: number) => {
  if (docType === DOC_TYPE_NOTA_CREDITO) return <Badge variant="destructive">NC {docType}</Badge>;
  if (docType === DOC_TYPE_NOTA_DEBITO) return <Badge className="bg-amber-600">ND {docType}</Badge>;
  return <Badge variant="secondary">{docType}</Badge>;
};

function SortableHeader({ column, label, align = 'left' }: { column: Column<SiiRcvRecordRow>; label: string; align?: 'left' | 'right' }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`${align === 'right' ? '-mr-3 ml-auto' : '-ml-3'} h-8 gap-1 px-2 font-semibold`}
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {label}
      <ArrowUpDown className="size-3.5 opacity-60" />
    </Button>
  );
}

function LinkBadge({ row, onView }: { row: SiiRcvRecordRow; onView?: (record: SiiRcvRecordRow) => void }) {
  const linked = row.book_type === 'compra' ? row.linked_cost : row.linked_service;
  if (!linked) return <Badge variant="secondary" className="whitespace-nowrap font-normal">Sin vincular</Badge>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          className="cursor-pointer whitespace-nowrap bg-emerald-600 hover:bg-emerald-700"
          role="button"
          tabIndex={0}
          onClick={() => onView?.(row)}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onView?.(row); } }}
        >
          Vinculado
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Ver detalle del vínculo</TooltipContent>
    </Tooltip>
  );
}

function ContainerBadge({ row }: { row: SiiRcvRecordRow }) {
  const linked = (row.container_purchase_links?.length ?? 0) > 0 || (row.container_cost_links?.length ?? 0) > 0;
  if (!linked) return null;
  return <Badge variant="outline" className="whitespace-nowrap border-teal-600/40 bg-teal-600/5 font-normal text-teal-700">Contenedor</Badge>;
}

interface SiiRcvTableProps {
  entityRut: string;
}

export function SiiRcvTable({ entityRut }: SiiRcvTableProps) {
  const isMobile = useIsMobile();
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';
  const [bookType, setBookType] = useState<SiiBookType | 'all'>('all');
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SiiRcvRecordRow | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<SiiRcvRecordRow | null>(null);
  const [linkingRecord, setLinkingRecord] = useState<SiiRcvRecordRow | null>(null);
  const [viewingRecord, setViewingRecord] = useState<SiiRcvRecordRow | null>(null);
  const manager = useSiiRcvManager(entityRut);

  // El badge/menú "Ver vínculo" abre el detalle de solo lectura del costo/servicio vinculado.
  const openLinkedDetail = (record: SiiRcvRecordRow) => {
    if (record.linked_cost_id || record.linked_service_id) setViewingRecord(record);
  };

  const { data, isLoading } = useSiiRcvPagedRecords(
    { entityRut, bookType: bookType === 'all' ? undefined : bookType },
    page,
    PAGE_SIZE,
  );
  const rows = data?.rows ?? [];

  const openCreate = () => {
    setEditingRecord(null);
    setFormOpen(true);
  };

  const openEdit = (record: SiiRcvRecordRow) => {
    setEditingRecord(record);
    setFormOpen(true);
  };

  const handleSave = async (values: SiiRcvRecordFormValues) => {
    if (editingRecord) {
      await manager.updateRecord.mutateAsync({ id: editingRecord.id, values });
    } else {
      await manager.createRecord.mutateAsync(values);
    }
  };

  const handleLink = async (linkedId: string | null) => {
    if (!linkingRecord) return;
    await manager.setLink.mutateAsync(linkingRecord.book_type === 'compra'
      ? { id: linkingRecord.id, linkedCostId: linkedId }
      : { id: linkingRecord.id, linkedServiceId: linkedId });
  };

  const unlink = async (record: SiiRcvRecordRow) => {
    try {
      await manager.setLink.mutateAsync(record.book_type === 'compra'
        ? { id: record.id, linkedCostId: null }
        : { id: record.id, linkedServiceId: null });
    } catch {
      // no-op: onError already handled it
    }
  };

  const columns = useMemo<ColumnDef<SiiRcvRecordRow>[]>(() => {
    const base: ColumnDef<SiiRcvRecordRow>[] = [
      {
        accessorKey: 'doc_date',
        header: ({ column }) => <SortableHeader column={column} label="Fecha" />,
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.doc_date}</span>,
      },
      {
        accessorKey: 'doc_type',
        header: ({ column }) => <SortableHeader column={column} label="Tipo Doc" />,
        cell: ({ row }) => docTypeBadge(Number(row.original.doc_type)),
      },
      {
        accessorKey: 'folio',
        header: ({ column }) => <SortableHeader column={column} label="Folio" />,
        cell: ({ row }) => <span className="font-mono">{row.original.folio}</span>,
      },
      {
        accessorKey: 'counterpart_rut',
        header: ({ column }) => <SortableHeader column={column} label="RUT" />,
        cell: ({ row }) => <span className="whitespace-nowrap font-mono text-xs">{row.original.counterpart_rut}</span>,
      },
      {
        accessorKey: 'counterpart_name',
        header: ({ column }) => <SortableHeader column={column} label="Razón social" />,
        cell: ({ row }) => (
          <div className="max-w-56">
            <p className="truncate" title={row.original.counterpart_name ?? undefined}>{row.original.counterpart_name || '—'}</p>
            {row.original.source === 'manual' && <span className="text-[11px] font-medium text-sky-600">Registro manual</span>}
          </div>
        ),
      },
      {
        accessorKey: 'net_amount',
        header: ({ column }) => <SortableHeader column={column} label="Neto" align="right" />,
        cell: ({ row }) => <div className="text-right">{formatCLP(row.original.net_amount)}</div>,
      },
      {
        accessorKey: 'tax_amount',
        header: ({ column }) => <SortableHeader column={column} label="IVA" align="right" />,
        cell: ({ row }) => <div className="text-right">{formatCLP(row.original.tax_amount)}</div>,
      },
      {
        accessorKey: 'total_amount',
        header: ({ column }) => <SortableHeader column={column} label="Total" align="right" />,
        cell: ({ row }) => <div className="text-right font-semibold">{formatCLP(row.original.total_amount)}</div>,
      },
      {
        id: 'link_status',
        accessorFn: (row) => Boolean(row.linked_cost_id || row.linked_service_id),
        header: ({ column }) => <SortableHeader column={column} label="Vínculo" />,
        cell: ({ row }) => <div className="flex flex-wrap gap-1"><LinkBadge row={row.original} onView={openLinkedDetail} /><ContainerBadge row={row.original} /></div>,
      },
    ];

    if (!isAdmin) return base;
    return [
      ...base,
      {
        id: 'actions',
        enableSorting: false,
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => {
          const record = row.original;
          const isLinked = Boolean(record.linked_cost_id || record.linked_service_id);
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Acciones para folio ${record.folio}`}><MoreHorizontal className="size-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isLinked && <DropdownMenuItem onClick={() => openLinkedDetail(record)}><Eye className="mr-2 size-4" />Ver vínculo</DropdownMenuItem>}
                  <DropdownMenuItem onClick={() => openEdit(record)}><Pencil className="mr-2 size-4" />Editar</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLinkingRecord(record)}><Link2 className="mr-2 size-4" />{isLinked ? 'Cambiar vínculo' : record.book_type === 'compra' ? 'Vincular a costo' : 'Vincular a servicio'}</DropdownMenuItem>
                  {isLinked && <DropdownMenuItem onClick={() => void unlink(record)}><Unlink className="mr-2 size-4" />Desvincular</DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletingRecord(record)}><Trash2 className="mr-2 size-4" />Eliminar</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ];
  }, [isAdmin]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <TooltipProvider delayDuration={150}>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">Registros de compras y ventas</CardTitle>
            {isAdmin && <Button size="sm" onClick={openCreate}><Plus className="mr-2 size-4" />Nuevo registro</Button>}
          </div>
          <Tabs value={bookType} onValueChange={(value) => { setBookType(value as SiiBookType | 'all'); setPage(1); setSorting([]); }}>
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="venta">Venta</TabsTrigger>
              <TabsTrigger value="compra">Compra</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="size-7 animate-spin" /></div>
          ) : isMobile ? (
            <div className="space-y-2 p-3">
              {table.getRowModel().rows.length ? table.getRowModel().rows.map(({ original: row }) => (
                <div key={row.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div><span className="font-medium">{row.doc_date}</span><p className="mt-1 text-xs text-muted-foreground">Folio {row.folio} · {row.counterpart_rut}</p></div>
                    <div className="flex items-center gap-1">{docTypeBadge(row.doc_type)}{isAdmin && <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="size-4" /></Button>}</div>
                  </div>
                  <p className="mt-2 truncate">{row.counterpart_name || 'Sin razón social'}</p>
                  <div className="mt-2 flex items-center justify-between gap-2"><div className="flex flex-wrap gap-1"><LinkBadge row={row} onView={openLinkedDetail} /><ContainerBadge row={row} /></div><p className="shrink-0 font-semibold">{formatCLP(row.total_amount)}</p></div>
                  {isAdmin && <div className="mt-3 flex gap-2 border-t pt-3"><Button variant="outline" size="sm" className="flex-1" onClick={() => setLinkingRecord(row)}><Link2 className="mr-2 size-4" />Vincular</Button><Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeletingRecord(row)}><Trash2 className="size-4" /></Button></div>}
                </div>
              )) : <p className="p-6 text-center text-muted-foreground">No hay registros para este filtro.</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1180px]">
                <TableHeader>{table.getHeaderGroups().map((headerGroup) => <TableRow key={headerGroup.id}>{headerGroup.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={columns.length} className="h-28 text-center text-muted-foreground">No hay registros para este filtro.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
          <AppPagination className="border-t py-4" currentPage={page} totalPages={data?.pageCount ?? 1} onPageChange={setPage} />
        </CardContent>
      </Card>

      {isAdmin && (
        <>
          <LowboyRecordForm
            open={formOpen}
            onOpenChange={setFormOpen}
            record={editingRecord}
            defaultBookType={bookType === 'venta' ? 'venta' : 'compra'}
            isPending={manager.createRecord.isPending || manager.updateRecord.isPending}
            onSubmit={handleSave}
          />
          <LowboyLinkDialog
            open={Boolean(linkingRecord)}
            onOpenChange={(open) => { if (!open) setLinkingRecord(null); }}
            record={linkingRecord}
            isPending={manager.setLink.isPending}
            onLink={handleLink}
          />
          <AlertDialog open={Boolean(deletingRecord)} onOpenChange={(open) => { if (!open) setDeletingRecord(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
                <AlertDialogDescription>Se eliminará el documento folio {deletingRecord?.folio}. Esta acción no elimina ningún costo ni servicio vinculado.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={manager.deleteRecord.isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={manager.deleteRecord.isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    if (!deletingRecord) return;
                    void manager.deleteRecord.mutateAsync(deletingRecord.id).then(() => setDeletingRecord(null)).catch(() => {
                      // no-op: onError already handled it (dialog stays open for retry)
                    });
                  }}
                >
                  {manager.deleteRecord.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      <LowboyLinkedDetailDialog
        open={Boolean(viewingRecord)}
        onOpenChange={(open) => { if (!open) setViewingRecord(null); }}
        record={viewingRecord}
        canChangeLink={isAdmin}
        onChangeLink={() => {
          const record = viewingRecord;
          setViewingRecord(null);
          setLinkingRecord(record);
        }}
      />
    </TooltipProvider>
  );
}
