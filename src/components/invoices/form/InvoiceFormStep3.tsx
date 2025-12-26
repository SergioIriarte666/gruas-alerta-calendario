import React from 'react';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';
import { FileCheck, FileX } from 'lucide-react';
import EnhancedClosureSelector from '../EnhancedClosureSelector';
import InvoiceSummary from '../InvoiceSummary';
import { DirectInvoiceForm } from './DirectInvoiceForm';
import { Client } from '@/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
  // Nuevas props para facturación directa
  directInvoiceMode?: boolean;
  onDirectInvoiceModeChange?: (enabled: boolean) => void;
  clients?: Client[];
  directClientId?: string;
  directSubtotal?: number;
  onDirectClientChange?: (clientId: string) => void;
  onDirectSubtotalChange?: (subtotal: number) => void;
  errors: {
    closureId?: string;
    clientId?: string;
    subtotal?: string;
  };
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
  directInvoiceMode = false,
  onDirectInvoiceModeChange,
  clients = [],
  directClientId = '',
  directSubtotal = 0,
  onDirectClientChange,
  onDirectSubtotalChange,
  errors 
}: InvoiceFormStep3Props) => {
  // Calcular montos para modo directo
  const directVat = Math.round(directSubtotal * 0.19);
  const directTotal = directSubtotal + directVat;

  return (
    <div className="space-y-4">
      {/* Toggle para modo de facturación - solo en creación */}
      {!isEditing && onDirectInvoiceModeChange && (
        <div className="bg-muted/30 rounded-lg p-4 border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {directInvoiceMode ? (
                <FileX className="h-5 w-5 text-orange-500" />
              ) : (
                <FileCheck className="h-5 w-5 text-violet-500" />
              )}
              <div>
                <Label className="text-sm font-medium cursor-pointer">
                  {directInvoiceMode ? 'Facturación Directa (Sin Cierre)' : 'Facturación con Cierre'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {directInvoiceMode 
                    ? 'Ingrese cliente y montos manualmente' 
                    : 'Seleccione un cierre de servicios existente'
                  }
                </p>
              </div>
            </div>
            <Switch
              checked={directInvoiceMode}
              onCheckedChange={onDirectInvoiceModeChange}
            />
          </div>
        </div>
      )}

      {/* Contenido según el modo */}
      {directInvoiceMode ? (
        // Modo facturación directa
        <ColoredSectionCard
          title="Facturación Directa"
          icon={<FileX className="h-5 w-5" />}
          color="orange"
          required
          hasError={!!errors.clientId || !!errors.subtotal}
        >
          <DirectInvoiceForm
            clients={clients}
            selectedClientId={directClientId}
            subtotal={directSubtotal}
            onClientChange={onDirectClientChange || (() => {})}
            onSubtotalChange={onDirectSubtotalChange || (() => {})}
            errors={{
              clientId: errors.clientId,
              subtotal: errors.subtotal
            }}
          />
        </ColoredSectionCard>
      ) : (
        // Modo con cierre (actual)
        <>
          <ColoredSectionCard
            title="Selección de Cierre"
            icon={<FileCheck className="h-5 w-5" />}
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
            />
            
            {errors.closureId && (
              <p className="text-sm text-destructive mt-2">{errors.closureId}</p>
            )}
          </ColoredSectionCard>

          {showSummary && (
            <ColoredSectionCard
              title="Resumen de Montos"
              icon={<FileCheck className="h-5 w-5" />}
              color="green"
            >
              <InvoiceSummary
                subtotal={subtotal}
                vat={vat}
                total={total}
              />
            </ColoredSectionCard>
          )}
        </>
      )}

      {/* Resumen para modo directo */}
      {directInvoiceMode && directSubtotal > 0 && (
        <ColoredSectionCard
          title="Resumen de Montos"
          icon={<FileCheck className="h-5 w-5" />}
          color="green"
        >
          <InvoiceSummary
            subtotal={directSubtotal}
            vat={directVat}
            total={directTotal}
          />
        </ColoredSectionCard>
      )}
    </div>
  );
};
