import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Ban, Search, FileText, Calendar, User, Building2, DollarSign, Info } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useInvoiceCancellation, InvoiceCancellation, CANCELLATION_REASONS } from '@/hooks/invoices/useInvoiceCancellation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toTitleCase } from '@/lib/utils';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateStr: string) => {
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy HH:mm", { locale: es });
  } catch {
    return 'Fecha inválida';
  }
};

const getReasonLabel = (reasonValue: string) => {
  const reason = CANCELLATION_REASONS.find(r => r.value === reasonValue);
  return reason?.label || reasonValue;
};

export const InvoiceCancellationsHistory = () => {
  const [cancellations, setCancellations] = useState<InvoiceCancellation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCancellation, setSelectedCancellation] = useState<InvoiceCancellation | null>(null);

  const { fetchCancellations } = useInvoiceCancellation();

  useEffect(() => {
    const loadCancellations = async () => {
      try {
        const data = await fetchCancellations();
        setCancellations(data);
      } catch (error) {
        console.error('Error loading cancellations:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCancellations();
  }, []);

  const filteredCancellations = cancellations.filter(c => {
    const search = searchTerm.toLowerCase();
    return (
      c.originalFolio.toLowerCase().includes(search) ||
      c.creditNoteNumber.toLowerCase().includes(search) ||
      c.clientName?.toLowerCase().includes(search) ||
      (c.originalNumeroFiscal && c.originalNumeroFiscal.toLowerCase().includes(search))
    );
  });

  // Calculate totals
  const totalCancelled = filteredCancellations.reduce((sum, c) => sum + c.originalTotal, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground">Cargando historial de anulaciones...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Ban className="size-6 text-destructive" />
            Historial de Anulaciones
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Registro de facturas anuladas con Nota de Crédito
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-lg">
            <span className="text-sm font-medium">Total Anulado:</span>
            <span className="ml-2 font-bold">{formatCurrency(totalCancelled)}</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por folio, NC, cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Empty State */}
      {filteredCancellations.length === 0 ? (
        <Card className="bg-card border">
          <CardContent className="p-8 text-center">
            <Ban className="mx-auto size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchTerm ? 'No se encontraron resultados' : 'No hay anulaciones registradas'}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm 
                ? 'Intenta con otros términos de búsqueda'
                : 'Las facturas anuladas aparecerán aquí con su historial completo'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Table */
        <Card className="bg-card border">
          <CardHeader>
            <CardTitle className="text-foreground">
              Anulaciones ({filteredCancellations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-foreground">Folio Original</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">N° Fiscal</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Nota de Crédito</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Cliente</th>
                    <th className="text-right py-3 px-4 font-medium text-foreground">Monto</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Motivo</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Anulado por</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Fecha</th>
                    <th className="text-center py-3 px-4 font-medium text-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCancellations.map((cancellation) => (
                    <tr key={cancellation.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <span className="font-medium text-foreground">{cancellation.originalFolio}</span>
                      </td>
                      <td className="py-3 px-4">
                        {cancellation.originalNumeroFiscal ? (
                          <span className="text-violet-600 font-medium">{cancellation.originalNumeroFiscal}</span>
                        ) : (
                          <span className="text-muted-foreground italic">Sin asignar</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                          {cancellation.creditNoteNumber}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-foreground">{toTitleCase(cancellation.clientName)}</td>
                      <td className="py-3 px-4 text-right font-medium text-foreground">
                        {formatCurrency(cancellation.originalTotal)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className="text-xs">
                          {getReasonLabel(cancellation.cancellationReason)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-foreground text-sm">{cancellation.cancelledByName}</td>
                      <td className="py-3 px-4 text-foreground text-sm">{formatDate(cancellation.cancelledAt)}</td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCancellation(cancellation)}
                          title="Ver detalles"
                        >
                          <Info className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Details Modal */}
      <Dialog open={!!selectedCancellation} onOpenChange={() => setSelectedCancellation(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="size-5 text-destructive" />
              Detalle de Anulación
            </DialogTitle>
            <DialogDescription>
              Información completa del registro de anulación
            </DialogDescription>
          </DialogHeader>

          {selectedCancellation && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="size-4" />
                    Folio Original
                  </div>
                  <p className="font-medium">{selectedCancellation.originalFolio}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="size-4" />
                    N° Fiscal
                  </div>
                  <p className="font-medium text-violet-600">
                    {selectedCancellation.originalNumeroFiscal || 'Sin asignar'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Ban className="size-4" />
                  Nota de Crédito
                </div>
                <p className="font-medium text-destructive">{selectedCancellation.creditNoteNumber}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="size-4" />
                  Cliente
                </div>
                <p className="font-medium">{toTitleCase(selectedCancellation.clientName)}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="size-4" />
                  Monto Anulado
                </div>
                <p className="font-bold text-lg">{formatCurrency(selectedCancellation.originalTotal)}</p>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Motivo de Anulación</div>
                <Badge variant="secondary">{getReasonLabel(selectedCancellation.cancellationReason)}</Badge>
                {selectedCancellation.reasonDetails && (
                  <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded">
                    {selectedCancellation.reasonDetails}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="size-4" />
                    Anulado por
                  </div>
                  <p className="text-sm">{selectedCancellation.cancelledByName}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="size-4" />
                    Fecha
                  </div>
                  <p className="text-sm">{formatDate(selectedCancellation.cancelledAt)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
