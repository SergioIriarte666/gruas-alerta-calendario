import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AppPagination } from '@/components/shared/AppPagination';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSiiRcvPagedRecords } from '@/hooks/useSiiRcv';
import type { SiiBookType, SiiRcvRecordRow } from '@/types/siiRcv';
import { DOC_TYPE_NOTA_CREDITO, DOC_TYPE_NOTA_DEBITO } from '@/types/siiRcv';

const PAGE_SIZE = 25;

const formatCLP = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value || 0);

const docTypeBadge = (docType: number) => {
  if (docType === DOC_TYPE_NOTA_CREDITO) return <Badge variant="destructive">NC {docType}</Badge>;
  if (docType === DOC_TYPE_NOTA_DEBITO) return <Badge className="bg-amber-600">ND {docType}</Badge>;
  return <Badge variant="secondary">{docType}</Badge>;
};

interface SiiRcvTableProps {
  entityRut: string;
}

export function SiiRcvTable({ entityRut }: SiiRcvTableProps) {
  const isMobile = useIsMobile();
  const [bookType, setBookType] = useState<SiiBookType | 'all'>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useSiiRcvPagedRecords(
    { entityRut, bookType: bookType === 'all' ? undefined : bookType },
    page,
    PAGE_SIZE,
  );

  const rows = data?.rows ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Registros importados</CardTitle>
        <Tabs
          value={bookType}
          onValueChange={(value) => { setBookType(value as SiiBookType | 'all'); setPage(1); }}
        >
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
            {rows.length ? rows.map((row: SiiRcvRecordRow) => (
              <div key={row.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{row.doc_date}</span>
                  {docTypeBadge(row.doc_type)}
                </div>
                <p className="mt-1 truncate text-muted-foreground">{row.counterpart_name || row.counterpart_rut} · Folio {row.folio}</p>
                <p className="mt-1 font-semibold">{formatCLP(row.total_amount)}</p>
              </div>
            )) : <p className="p-6 text-center text-muted-foreground">No hay registros para este filtro.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo Doc</TableHead>
                  <TableHead>Folio</TableHead>
                  <TableHead>Contraparte</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length ? rows.map((row: SiiRcvRecordRow) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">{row.doc_date}</TableCell>
                    <TableCell>{docTypeBadge(row.doc_type)}</TableCell>
                    <TableCell>{row.folio}</TableCell>
                    <TableCell className="max-w-64 truncate">{row.counterpart_name || row.counterpart_rut}</TableCell>
                    <TableCell className="text-right">{formatCLP(row.net_amount)}</TableCell>
                    <TableCell className="text-right">{formatCLP(row.tax_amount)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCLP(row.total_amount)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={7} className="h-28 text-center text-muted-foreground">No hay registros para este filtro.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
        <AppPagination className="border-t py-4" currentPage={page} totalPages={data?.pageCount ?? 1} onPageChange={setPage} />
      </CardContent>
    </Card>
  );
}
