import React from 'react';
// InvoiceFormStep3 component for closure selection
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';
import { FileCheck } from 'lucide-react';
import EnhancedClosureSelector from '../EnhancedClosureSelector';
import InvoiceSummary from '../InvoiceSummary';
import { ClosureWithClient } from '@/hooks/useClosuresForInvoices';

interface InvoiceFormStep3Props {
  selectedClosureId: string;
  isEditing: boolean;
  currentInvoice?: { id: string; closureId: string | null };
  canEditClosure: boolean;
  subtotal: number;
  vat: number;
  total: number;
  showSummary: boolean;
  onClosureChange: (closureId: string) => void;
  errors: {
    closureId?: string;
  };
  closures?: ClosureWithClient[];
  loading?: boolean;
}

export const InvoiceFormStep3 = ({ 
  selectedClosureId,
  isEditing,
  currentInvoice,
  canEditClosure,
  subtotal,
  vat,
  total,
  showSummary,
  onClosureChange,
  errors,
  closures,
  loading
}: InvoiceFormStep3Props) => {
  return (
    <div className="space-y-4">
      <ColoredSectionCard
        title="Selección de Cierre"
        icon={<FileCheck className="size-5" />}
        color="purple"
        required
        hasError={!!errors.closureId}
      >
        <EnhancedClosureSelector
          selectedClosureId={selectedClosureId}
          onClosureChange={onClosureChange}
          isEditing={isEditing}
          currentInvoice={currentInvoice}
          disabled={!canEditClosure}
          closures={closures}
          loading={loading}
        />
        
        {errors.closureId && (
          <p className="text-sm text-destructive mt-2">{errors.closureId}</p>
        )}
      </ColoredSectionCard>

      {showSummary && (
        <ColoredSectionCard
          title="Resumen de Montos"
          icon={<FileCheck className="size-5" />}
          color="green"
        >
          <InvoiceSummary
            subtotal={subtotal}
            vat={vat}
            total={total}
          />
        </ColoredSectionCard>
      )}
    </div>
  );
};
