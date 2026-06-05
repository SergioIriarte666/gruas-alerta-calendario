import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditCard, Loader2, Calendar, Building2 } from 'lucide-react';
import DatePickerInput from '@/components/common/DatePickerInput';
import { AutocompleteInput } from '@/components/common/AutocompleteInput';
import { useFrequentSupplierData } from '@/hooks/useFrequentSupplierData';
import { usePendingPayments } from '@/hooks/usePendingPayments';
import { useSuppliers } from '@/hooks/useSuppliers';
import { PendingPaymentSelector } from './form/PendingPaymentSelector';

import { getTodayLocal } from '@/utils/timezoneUtils';

interface RegisterPaymentModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export const RegisterPaymentModal: React.FC<RegisterPaymentModalProps> = ({
  onClose,
  onSuccess
}) => {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all');
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(
    getTodayLocal()
  );
  const [bankReference, setBankReference] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('transfer');
  const [notes, setNotes] = useState<string>('');

  const { suppliers } = useSuppliers();
  const { referenceSuggestions } = useFrequentSupplierData();
  const { 
    pendingPayments, 
    isLoading, 
    registerPayment, 
    isRegistering 
  } = usePendingPayments(selectedSupplierId === 'all' ? undefined : selectedSupplierId);

  // Filter payments based on selected supplier
  const filteredPayments = useMemo(() => {
    if (selectedSupplierId === 'all') {
      return pendingPayments;
    }
    return pendingPayments.filter(p => p.supplier_id === selectedSupplierId);
  }, [pendingPayments, selectedSupplierId]);

  const handleSelectionChange = (ids: string[], total: number) => {
    setSelectedPaymentIds(ids);
    setTotalAmount(total);
  };

  const handleSupplierChange = (value: string) => {
    setSelectedSupplierId(value);
    setSelectedPaymentIds([]);
    setTotalAmount(0);
  };

  const handleSubmit = () => {
    if (selectedPaymentIds.length === 0) {
      return;
    }

    registerPayment(
      {
        paymentIds: selectedPaymentIds,
        paymentDate,
        bankReference: bankReference || undefined,
        paymentMethod,
        notes: notes || undefined
      },
      {
        onSuccess: () => {
          onSuccess?.();
          onClose();
        }
      }
    );
  };

  const paymentMethods = [
    { value: 'transfer', label: 'Transferencia' },
    { value: 'check', label: 'Cheque' },
    { value: 'cash', label: 'Efectivo' },
    { value: 'card', label: 'Tarjeta' },
    { value: 'other', label: 'Otro' }
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl border-border/70 bg-card p-0">
        <DialogHeader className="sticky top-0 z-10 border-b border-border/70 bg-muted/20 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <CreditCard className="size-5 text-primary" />
            Registrar Pago
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 px-6 py-6">
          {/* Supplier filter */}
          <div>
            <Label className="text-foreground flex items-center gap-2 mb-2">
              <Building2 className="size-4" />
              Filtrar por Proveedor
            </Label>
            <Select value={selectedSupplierId} onValueChange={handleSupplierChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los proveedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los proveedores</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pending payments selector */}
          <div>
            <Label className="text-foreground mb-2 block">Facturas Pendientes</Label>
            <div className="border rounded-lg p-4 bg-muted/20">
              <PendingPaymentSelector
                payments={filteredPayments}
                isLoading={isLoading}
                selectedIds={selectedPaymentIds}
                onSelectionChange={handleSelectionChange}
              />
            </div>
          </div>

          {/* Total selected */}
          {selectedPaymentIds.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/20">
              <span className="font-medium">Total Seleccionado:</span>
              <span className="text-2xl font-bold text-primary">
                ${totalAmount.toLocaleString('es-CL')}
              </span>
            </div>
          )}

          {/* Payment details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-foreground flex items-center gap-2 mb-2">
                <Calendar className="size-4" />
                Fecha de Pago
              </Label>
              <DatePickerInput
                value={paymentDate}
                onChange={setPaymentDate}
                placeholder="Seleccionar fecha"
              />
            </div>

            <div>
              <Label className="text-foreground mb-2 block">Método de Pago</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar método" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label className="text-foreground mb-2 block">Referencia Bancaria</Label>
              <AutocompleteInput
                value={bankReference}
                onValueChange={setBankReference}
                suggestions={referenceSuggestions}
                placeholder="Número de transferencia, cheque, etc."
              />
            </div>

            <div className="md:col-span-2">
              <Label className="text-foreground mb-2 block">Notas</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Información adicional del pago..."
                rows={2}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-border/70 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isRegistering}
              className="border-border/70 bg-background/60"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={selectedPaymentIds.length === 0 || isRegistering}
            >
              {isRegistering ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <CreditCard className="size-4 mr-2" />
                  Registrar Pago ({selectedPaymentIds.length})
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
