
import React, { useState, useMemo } from 'react';
import { useInvoices } from '@/hooks/useInvoices';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Upload, FileText } from 'lucide-react';
import { formatCurrency } from '@/utils/statusHelpers';

interface InvoiceHistoricalTabProps {
  onOpenImportHistory: () => void;
}

const HISTORICAL_NOTE = 'Importación historial 2025';

const InvoiceHistoricalTab: React.FC<InvoiceHistoricalTabProps> = ({ onOpenImportHistory }) => {
  const { invoices, loading, getInvoiceWithDetails } = useInvoices();
  const [searchTerm, setSearchTerm] = useState('');

  const historicalInvoices = useMemo(() => {
    return invoices.filter(inv => inv.notes === HISTORICAL_NOTE);
  }, [invoices]);

  const filtered = useMemo(() => {
    if (!searchTerm) return historicalInvoices;
    const term = searchTerm.toLowerCase();
    return historicalInvoices.filter(inv => {
      const details = getInvoiceWithDetails(inv);
      return (
        inv.folio.toLowerCase().includes(term) ||
        (inv.numeroFiscal && inv.numeroFiscal.toLowerCase().includes(term)) ||
        (details.client?.name && details.client.name.toLowerCase().includes(term))
      );
    });
  }, [historicalInvoices, searchTerm, getInvoiceWithDetails]);

  const stats = useMemo(() => {
    const total = historicalInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    const paid = historicalInvoices.filter(inv => inv.status === 'paid').length;
    return { count: historicalInvoices.length, total, paid };
  }, [historicalInvoices]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/80 text-white border-none text-[10px]">Pagada</Badge>;
      case 'overdue':
        return <Badge className="bg-red-500/80 text-white border-none text-[10px]">Vencida</Badge>;
      case 'sent':
        return <Badge className="bg-blue-500/80 text-white border-none text-[10px]">Enviada</Badge>;
      case 'draft':
        return <Badge className="bg-gray-500/80 text-white border-none text-[10px]">Borrador</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground">Cargando histórico...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Histórico de Facturas</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Facturas importadas del sistema anterior — solo lectura
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenImportHistory}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          Importar Historial
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{stats.count}</p>
          <p className="text-xs text-muted-foreground">Facturas importadas</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.total)}</p>
          <p className="text-xs text-muted-foreground">Total facturado</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-500">{stats.paid}</p>
          <p className="text-xs text-muted-foreground">Pagadas</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          type="text"
          placeholder="Buscar por folio, número fiscal o cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground">
            {historicalInvoices.length === 0 ? 'Sin facturas históricas' : 'Sin resultados'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {historicalInvoices.length === 0
              ? 'Importa el historial de facturación desde un archivo CSV o XLSX.'
              : 'Intenta con otros términos de búsqueda.'}
          </p>
          {historicalInvoices.length === 0 && (
            <Button variant="outline" className="mt-4 gap-2" onClick={onOpenImportHistory}>
              <Upload className="h-4 w-4" />
              Importar Historial
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Folio</TableHead>
                <TableHead className="text-xs font-semibold">N° Fiscal</TableHead>
                <TableHead className="text-xs font-semibold">Cliente</TableHead>
                <TableHead className="text-xs font-semibold">Fecha</TableHead>
                <TableHead className="text-xs font-semibold text-right">Total</TableHead>
                <TableHead className="text-xs font-semibold">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => {
                const details = getInvoiceWithDetails(inv);
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="text-xs font-medium">{inv.folio}</TableCell>
                    <TableCell className="text-xs">{inv.numeroFiscal || '—'}</TableCell>
                    <TableCell className="text-xs truncate max-w-[200px]">
                      {details.client?.name || '—'}
                    </TableCell>
                    <TableCell className="text-xs">{inv.issueDate}</TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      {formatCurrency(Number(inv.total))}
                    </TableCell>
                    <TableCell>{getStatusBadge(inv.status)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default InvoiceHistoricalTab;
