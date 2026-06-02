import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, X, DollarSign, Receipt } from 'lucide-react';

import { PaymentWithDetails } from '@/types/payments';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';
import { createLogger } from "@/lib/logger";


const logger = createLogger("SelectivePaymentModal");
interface SelectivePaymentModalProps {
  payment: PaymentWithDetails;
  isOpen: boolean;
  onClose: () => void;
  onApply: (fiscalNumbers: string[], applyOnlyToSpecified?: boolean) => Promise<void>;
}

interface Invoice {
  id: string;
  folio: string;
  numero_fiscal: string;
  total: number;
  paid_amount: number;
  status: string;
  remaining_amount: number;
}

export const SelectivePaymentModal: React.FC<SelectivePaymentModalProps> = ({
  payment,
  isOpen,
  onClose,
  onApply
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiscalNumbers, setSelectedFiscalNumbers] = useState<string[]>([]);
  const [availableInvoices, setAvailableInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  
  const batchProgress = useBatchProgress();

  useEffect(() => {
    if (isOpen && payment) {
      loadAvailableInvoices();
    }
  }, [isOpen, payment]);

  const loadAvailableInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, folio, numero_fiscal, total, paid_amount, status, due_date, remaining_amount')
        .eq('client_id', payment.client_id)
        .in('status', ['sent', 'overdue', 'partial'])
        .not('folio', 'like', 'HIST-%')
        .gt('remaining_amount', 0)
        .order('due_date', { ascending: true });

      if (error) throw error;

      // Usar remaining_amount directamente de la DB (calculado por trigger)
      setAvailableInvoices(data || []);
    } catch (error) {
      logger.error('Error loading invoices:', error);
      toast.error('Error al cargar facturas disponibles');
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = availableInvoices.filter(invoice => 
    invoice.folio.toLowerCase().includes(searchQuery.toLowerCase()) ||
    invoice.numero_fiscal?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleInvoiceToggle = (fiscalNumber: string) => {
    setSelectedFiscalNumbers(prev => 
      prev.includes(fiscalNumber)
        ? prev.filter(fn => fn !== fiscalNumber)
        : [...prev, fiscalNumber]
    );
  };

  const handleApply = async () => {
    if (selectedFiscalNumbers.length === 0) {
      toast.error('Seleccione al menos una factura');
      return;
    }

    setIsApplying(true);
    batchProgress.start('Aplicando pago a facturas', selectedFiscalNumbers.length);
    
    try {
      // Simular progreso por factura
      for (let i = 0; i < selectedFiscalNumbers.length; i++) {
        batchProgress.update(i + 1, selectedFiscalNumbers[i]);
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      await onApply(selectedFiscalNumbers, true);
      batchProgress.complete();
      
      setTimeout(() => {
        batchProgress.close();
        toast.success('Pago aplicado exitosamente a las facturas seleccionadas');
        onClose();
      }, 1500);
    } catch (error) {
      logger.error('Error applying payment:', error);
      batchProgress.error('Error al aplicar el pago');
    } finally {
      setIsApplying(false);
    }
  };

  const selectedInvoices = availableInvoices.filter(inv => 
    selectedFiscalNumbers.includes(inv.numero_fiscal)
  );
  const totalSelectedAmount = selectedInvoices.reduce((sum, inv) => sum + inv.remaining_amount, 0);
  const remainingPaymentAmount = Math.max(0, payment.remaining_amount - totalSelectedAmount);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden border-border/70 bg-card p-0">
          <DialogHeader className="border-b border-border/70 bg-muted/20 px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="size-5 text-primary" />
              Aplicar Pago a Facturas Específicas
            </DialogTitle>
            <div className="text-sm text-muted-foreground">
            Cliente: {payment.client?.name ? toTitleCase(payment.client.name) : ''} | Monto disponible: {formatCurrency(payment.remaining_amount)}
          </div>
          </DialogHeader>

          <div className="flex flex-1 flex-col px-6 py-6">
          {/* Resumen */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Card className="border-primary/20 bg-primary/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-primary">Facturas Seleccionadas</p>
                    <p className="text-2xl font-bold text-foreground">{selectedFiscalNumbers.length}</p>
                  </div>
                  <Receipt className="size-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-success/20 bg-success/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-success">Saldo Restante</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(remainingPaymentAmount)}</p>
                  </div>
                  <DollarSign className="size-8 text-success" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Búsqueda */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por folio o número fiscal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Lista de facturas */}
          <div className="flex-1 overflow-y-auto border rounded-lg">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                Cargando facturas...
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No se encontraron facturas disponibles
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {filteredInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedFiscalNumbers.includes(invoice.numero_fiscal)
                        ? 'border-primary/30 bg-primary/10'
                        : 'bg-card hover:bg-muted/40'
                    }`}
                    onClick={() => handleInvoiceToggle(invoice.numero_fiscal)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{invoice.folio}</span>
                          <Badge variant="outline" className="text-xs">
                            {invoice.numero_fiscal}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Total: {formatCurrency(invoice.total)} | 
                          Pendiente: {formatCurrency(invoice.remaining_amount)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedFiscalNumbers.includes(invoice.numero_fiscal) && (
                          <Badge className="border-primary/20 bg-primary text-primary-foreground">Seleccionada</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-4">
            <p className="text-sm font-medium text-warning">
              La aplicación selectiva solo afecta las facturas que selecciones aquí.
            </p>
            <p className="mt-2 text-xs text-warning">
              El saldo no asignado queda pendiente para aplicación manual posterior.
            </p>
          </div>

          {/* Facturas seleccionadas */}
          {selectedFiscalNumbers.length > 0 && (
            <div className="mt-4 rounded-lg border border-border/70 bg-muted/30 p-4">
              <h4 className="font-medium mb-2">Facturas Seleccionadas:</h4>
              <div className="flex flex-wrap gap-2">
                {selectedFiscalNumbers.map((fiscalNumber) => {
                  const invoice = availableInvoices.find(inv => inv.numero_fiscal === fiscalNumber);
                  return (
                    <Badge 
                      key={fiscalNumber} 
                      variant="secondary" 
                      className="flex items-center gap-1"
                    >
                      {fiscalNumber}
                      {invoice && ` (${formatCurrency(invoice.remaining_amount)})`}
                      <X 
                        className="size-3 cursor-pointer" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInvoiceToggle(fiscalNumber);
                        }}
                      />
                    </Badge>
                  );
                })}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Total a aplicar: {formatCurrency(totalSelectedAmount)} | 
                Saldo restante: {formatCurrency(remainingPaymentAmount)}
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-3 border-t border-border/70 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isApplying}>
              Cancelar
            </Button>
            <Button 
              onClick={handleApply} 
              disabled={selectedFiscalNumbers.length === 0 || isApplying}
            >
              {isApplying ? 'Aplicando...' : 'Aplicar Pago'}
            </Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <BatchProgressModal state={batchProgress.state} onClose={batchProgress.close} />
    </>
  );
};
