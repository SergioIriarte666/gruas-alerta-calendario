# Prompt: Módulo de Facturación

## Descripción General

Este documento describe la implementación completa del **Módulo de Facturación** para un sistema de gestión de servicios. Las facturas se crean a partir de **Cierres de Servicios** (ver `closure-module-prompt.md`), estableciendo una relación directa entre ambos módulos.

### Características Principales

- **Dependencia con Cierres**: Las facturas REQUIEREN un cierre en estado "closed" - esto es obligatorio
- **Modal de 2 columnas**: Navegación/resumen lateral + contenido principal
- **Formulario de 3 pasos**: Estado, Fechas, Selección de Cierre
- **Cálculo automático**: Subtotal (del cierre) + IVA 19% = Total
- **5 estados**: draft, sent, paid, overdue, cancelled
- **Sistema de anulación**: Con Nota de Crédito y audit trail completo
- **Condiciones de pago**: Auto-calculan fecha de vencimiento
- **Detección automática de vencidas**: Facturas vencidas se actualizan automáticamente
- **Propagación de folio**: El folio de factura se propaga a todos los servicios del cierre

### Flujo de Facturación

```
Cierre (closed) → Factura (draft) → Enviada (sent) → Pagada (paid)
                                          ↓
                                    Vencida (overdue)
                                          ↓
                                    Pagada (paid)

Cualquier estado → Anulada (cancelled) [requiere Nota de Crédito]
```

---

## Estructura del Formulario (3 Pasos)

### Paso 1 - Estado y Configuración

**Campos:**
- **Estado**: Select con opciones (draft, sent, paid, overdue, cancelled)
- **Número Fiscal**: Input opcional para registro SII

**Componentes:**
- `ColoredSectionCard` color purple para estado
- `ColoredSectionCard` color blue para número fiscal

### Paso 2 - Fechas y Condiciones

**Campos:**
- **Condición de Pago**: Select que auto-calcula vencimiento según días
- **Fecha de Emisión**: DatePicker
- **Fecha de Vencimiento**: DatePicker (auto-calculado o manual)
- **Fecha de Pago**: DatePicker (solo visible si status = 'paid')

**Componentes:**
- `ColoredSectionCard` color orange para condiciones
- `ColoredSectionCard` color cyan para fechas
- `ColoredSectionCard` color green para fecha de pago (condicional)

### Paso 3 - Selección de Cierre

**Campos:**
- **Cierre**: Selector con búsqueda multi-campo (folio, cliente, fecha)
- **Resumen de Montos**: Solo lectura (Subtotal, IVA 19%, Total)

**Componentes:**
- `EnhancedClosureSelector` con Command/Popover
- `InvoiceSummary` para mostrar cálculos

---

## Interfaces TypeScript

```typescript
// src/types/index.ts

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string;
  folio: string;
  closureId: string | null;
  clientId: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  vat: number;
  total: number;
  status: InvoiceStatus;
  paymentDate?: string | null;
  paymentTermId?: string | null;
  numeroFiscal?: string | null;
  paidAmount: number;
  remainingAmount: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  
  // Relaciones opcionales (JOINs)
  client?: {
    id: string;
    name: string;
    rut: string;
    email?: string;
    phone?: string;
  };
  creator?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface PaymentTerm {
  id: string;
  name: string;
  days: number;
  description?: string;
  is_active: boolean;
  display_order: number;
  created_at?: string;
  created_by?: string;
}

export interface InvoiceFormStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  isCompleted: boolean;
  hasError: boolean;
}

export interface CancellationData {
  invoiceId: string;
  creditNoteNumber: string;
  cancellationReason: string;
  reasonDetails?: string;
}

export interface InvoiceCancellation {
  id: string;
  invoiceId: string;
  creditNoteNumber: string;
  cancellationReason: string;
  reasonDetails?: string;
  cancelledBy?: string;
  cancelledAt: string;
  originalFolio: string;
  originalNumeroFiscal?: string;
  originalTotal: number;
  originalClientId?: string;
  clientName?: string;
  cancelledByName?: string;
}
```

---

## Componentes Principales

### InvoiceForm.tsx

Layout principal de 2 columnas con 3 pasos:

```typescript
import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Invoice, InvoiceStatus } from '@/types';
import { useClosuresForInvoices } from '@/hooks/useClosuresForInvoices';
import { usePaymentTerms } from '@/hooks/usePaymentTerms';
import { ChevronLeft, ChevronRight, Save, X, Receipt } from 'lucide-react';
import { InvoiceFormStepNavigation, getInvoiceFormSteps } from './form/InvoiceFormStepNavigation';
import { InvoiceSummaryPanel } from './form/InvoiceSummaryPanel';
import { InvoiceFormStep1 } from './form/InvoiceFormStep1';
import { InvoiceFormStep2 } from './form/InvoiceFormStep2';
import { InvoiceFormStep3 } from './form/InvoiceFormStep3';

const invoiceSchema = z.object({
  closureId: z.string().min(1, 'Debe seleccionar un cierre'),
  issueDate: z.string().min(1, 'Fecha de emisión es requerida'),
  dueDate: z.string().min(1, 'Fecha de vencimiento es requerida'),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const),
  paymentTermId: z.string().optional(),
  paymentDate: z.string().optional(),
  numeroFiscal: z.string().optional()
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

interface InvoiceFormProps {
  invoice?: Invoice | null;
  preselectedClosureId?: string | null;
  onSubmit: (data: InvoiceFormData & { 
    subtotal: number; 
    vat: number; 
    total: number; 
    clientId: string 
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
  invoice,
  preselectedClosureId,
  onSubmit,
  onCancel,
  isLoading = false
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const isEditing = !!invoice;
  
  const { closures } = useClosuresForInvoices({ includeInvoiced: isEditing });
  const { paymentTerms, loading: loadingTerms } = usePaymentTerms();
  
  const { watch, setValue, formState: { errors, isSubmitting }, reset, handleSubmit } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      closureId: preselectedClosureId || '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'draft' as InvoiceStatus,
      paymentTermId: undefined,
      paymentDate: '',
      numeroFiscal: ''
    },
    mode: 'onChange'
  });

  const selectedClosureId = watch('closureId');
  const selectedClosure = useMemo(() => 
    closures.find(c => c.id === selectedClosureId), 
    [closures, selectedClosureId]
  );
  
  // Cálculo automático de montos
  const { subtotal, vat, total } = useMemo(() => {
    const subtotalValue = Math.round(selectedClosure?.total || 0);
    const vatValue = Math.round(subtotalValue * 0.19);
    return { subtotal: subtotalValue, vat: vatValue, total: subtotalValue + vatValue };
  }, [selectedClosure?.total]);

  // Auto-calcular fecha de vencimiento según condición de pago
  useEffect(() => {
    const termId = watch('paymentTermId');
    const issueDate = watch('issueDate');
    if (termId && issueDate && !isEditing) {
      const term = paymentTerms.find(t => t.id === termId);
      if (term && term.days > 0) {
        const dueDate = new Date(issueDate);
        dueDate.setDate(dueDate.getDate() + term.days);
        setValue('dueDate', dueDate.toISOString().split('T')[0]);
      }
    }
  }, [watch('paymentTermId'), watch('issueDate'), paymentTerms, setValue, isEditing]);

  const handleFormSubmit = useCallback(async (data: InvoiceFormData) => {
    if (!selectedClosure) throw new Error('Debe seleccionar un cierre');
    await onSubmit({ 
      ...data, 
      subtotal, 
      vat, 
      total, 
      clientId: selectedClosure.clientId 
    });
  }, [selectedClosure, subtotal, vat, total, onSubmit]);

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: return true;
      case 2: return watch('issueDate') !== '' && watch('dueDate') !== '';
      case 3: return watch('closureId') !== '';
      default: return true;
    }
  };

  const canGoNext = validateStep(currentStep);
  const canSubmit = validateStep(1) && validateStep(2) && validateStep(3);

  return (
    <Card className="bg-card border max-h-[90vh] overflow-hidden flex flex-col">
      <CardHeader className="bg-gradient-to-r from-violet-600 to-violet-500 text-white">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {isEditing ? 'Editar Factura' : 'Nueva Factura'}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel} 
            className="text-white/80 hover:text-white hover:bg-white/20">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
              {/* Panel izquierdo: Navegación + Resumen */}
              <div className="lg:col-span-1 space-y-4">
                <InvoiceFormStepNavigation 
                  steps={steps} 
                  currentStep={currentStep} 
                  onStepClick={setCurrentStep} 
                />
                <InvoiceSummaryPanel 
                  status={watch('status')} 
                  numeroFiscal={watch('numeroFiscal') || ''} 
                  issueDate={watch('issueDate')} 
                  dueDate={watch('dueDate')} 
                  paymentDate={watch('paymentDate') || ''} 
                  clientName={selectedClosure?.clientName || ''} 
                  closureFolio={selectedClosure?.folio || ''} 
                  subtotal={subtotal} 
                  vat={vat} 
                  total={total} 
                  isEditing={isEditing} 
                />
              </div>
              
              {/* Panel derecho: Contenido del paso */}
              <div className="lg:col-span-2">
                {renderStepContent()}
              </div>
            </div>
          </div>

          {/* Footer con navegación - STICKY */}
          <div className="border-t bg-card p-4 flex-shrink-0 sticky bottom-0">
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" 
                onClick={() => currentStep > 1 && setCurrentStep(currentStep - 1)} 
                disabled={currentStep === 1}>
                <ChevronLeft className="h-4 w-4 mr-2" /> Anterior
              </Button>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
                {currentStep < 3 ? (
                  <Button type="button" 
                    onClick={() => canGoNext && setCurrentStep(currentStep + 1)} 
                    disabled={!canGoNext}
                    className="bg-violet-600 hover:bg-violet-700 text-white">
                    Siguiente <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button type="button" 
                    onClick={handleSubmit(handleFormSubmit)} 
                    disabled={!canSubmit || isSubmitting || isLoading}
                    className="bg-violet-600 hover:bg-violet-700 text-white">
                    <Save className="h-4 w-4 mr-2" />
                    {isSubmitting || isLoading ? 'Guardando...' : 
                      `${isEditing ? 'Actualizar' : 'Crear'} Factura`}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
```

### InvoiceFormStepNavigation.tsx

Navegación lateral con indicadores de progreso:

```typescript
import React from 'react';
import { Check, Settings, Calendar, FileCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InvoiceFormStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  isCompleted: boolean;
  hasError: boolean;
}

interface InvoiceFormStepNavigationProps {
  steps: InvoiceFormStep[];
  currentStep: number;
  onStepClick: (stepId: number) => void;
}

export const InvoiceFormStepNavigation = ({
  steps,
  currentStep,
  onStepClick,
}: InvoiceFormStepNavigationProps) => {
  return (
    <div className="space-y-2">
      {steps.map((step) => {
        const isActive = step.id === currentStep;
        const isPast = step.id < currentStep;
        const isClickable = step.id <= currentStep || step.isCompleted;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => isClickable && onStepClick(step.id)}
            disabled={!isClickable}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left",
              isActive && "bg-violet-500/10 border border-violet-500/30",
              isPast && !isActive && "bg-muted/50",
              !isActive && !isPast && "hover:bg-muted/30",
              step.hasError && "border-destructive/50 bg-destructive/5",
              !isClickable && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className={cn(
              "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
              isActive && "bg-violet-600 text-white",
              step.isCompleted && !isActive && "bg-violet-500 text-white",
              step.hasError && "bg-destructive text-destructive-foreground",
              !isActive && !step.isCompleted && !step.hasError && "bg-muted text-muted-foreground"
            )}>
              {step.isCompleted && !step.hasError ? (
                <Check className="h-4 w-4" />
              ) : (
                step.id
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium truncate",
                isActive && "text-violet-700 dark:text-violet-300",
                step.hasError && "text-destructive"
              )}>
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {step.description}
              </p>
            </div>

            <div className={cn(
              "flex-shrink-0 text-muted-foreground",
              isActive && "text-violet-600 dark:text-violet-400"
            )}>
              {step.icon}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export const getInvoiceFormSteps = (): Omit<InvoiceFormStep, 'isCompleted' | 'hasError'>[] => [
  {
    id: 1,
    title: 'Estado y Configuración',
    description: 'Estado y número fiscal',
    icon: <Settings className="h-4 w-4" />,
  },
  {
    id: 2,
    title: 'Fechas y Condiciones',
    description: 'Emisión, vencimiento y pago',
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    id: 3,
    title: 'Selección de Cierre',
    description: 'Cierre a facturar',
    icon: <FileCheck className="h-4 w-4" />,
  },
];
```

### InvoiceSummaryPanel.tsx

Panel de resumen en tiempo real:

```typescript
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Receipt, Calendar, DollarSign, FileText, Building2 } from 'lucide-react';

interface InvoiceSummaryPanelProps {
  status: string;
  numeroFiscal: string;
  issueDate: string;
  dueDate: string;
  paymentDate: string;
  clientName: string;
  closureFolio: string;
  subtotal: number;
  vat: number;
  total: number;
  isEditing: boolean;
}

export const InvoiceSummaryPanel = ({
  status,
  numeroFiscal,
  issueDate,
  dueDate,
  paymentDate,
  clientName,
  closureFolio,
  subtotal,
  vat,
  total,
  isEditing,
}: InvoiceSummaryPanelProps) => {
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('es-CL', { 
      style: 'currency', 
      currency: 'CLP', 
      maximumFractionDigits: 0 
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-CL');
  };

  const getStatusBadge = () => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      draft: { label: 'Borrador', className: 'bg-gray-500/20 text-gray-700' },
      sent: { label: 'Enviada', className: 'bg-blue-500/20 text-blue-700' },
      paid: { label: 'Pagada', className: 'bg-green-500/20 text-green-700' },
      overdue: { label: 'Vencida', className: 'bg-red-500/20 text-red-700' },
      cancelled: { label: 'Anulada', className: 'bg-orange-500/20 text-orange-700' },
    };
    const config = statusConfig[status] || statusConfig.draft;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  return (
    <Card className="bg-gradient-to-b from-card to-muted/30 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-violet-500" />
            Resumen de Factura
          </span>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Número Fiscal */}
        {numeroFiscal && (
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">N° Fiscal:</span>
            <span className="text-sm font-mono font-semibold text-violet-600">
              {numeroFiscal}
            </span>
          </div>
        )}

        {/* Cliente */}
        {clientName && (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Cliente:</span>
            <span className="text-sm font-medium truncate">{clientName}</span>
          </div>
        )}

        {/* Cierre */}
        {closureFolio && (
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Cierre:</span>
            <Badge variant="secondary" className="text-xs bg-violet-500/10 text-violet-700">
              {closureFolio}
            </Badge>
          </div>
        )}

        <Separator />

        {/* Fechas */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Fechas:</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs ml-6">
            <div>
              <span className="text-muted-foreground">Emisión:</span>
              <span className="ml-1">{formatDate(issueDate)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Vencimiento:</span>
              <span className="ml-1">{formatDate(dueDate)}</span>
            </div>
            {paymentDate && status === 'paid' && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Pago:</span>
                <span className="ml-1 text-green-600">{formatDate(paymentDate)}</span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Totales */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Montos:</span>
          </div>
          
          <div className="space-y-1 ml-6 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IVA (19%):</span>
              <span>{formatCurrency(vat)}</span>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between font-semibold">
              <span>Total:</span>
              <span className="text-violet-600">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Indicador de modo edición */}
        {isEditing && (
          <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-md">
            <p className="text-xs text-amber-700">
              Modo edición - Los cambios actualizarán la factura existente
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

### EnhancedClosureSelector.tsx

Selector de cierres con búsqueda:

```typescript
import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useClosuresForInvoices } from '@/hooks/useClosuresForInvoices';
import { useClients } from '@/hooks/useClients';
import { Check, ChevronDown, FileText, Calendar, User, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnhancedClosureSelectorProps {
  selectedClosureId: string;
  onClosureChange: (closureId: string) => void;
  isEditing?: boolean;
  currentInvoice?: { id: string; closureId: string };
  disabled?: boolean;
}

const EnhancedClosureSelector: React.FC<EnhancedClosureSelectorProps> = ({
  selectedClosureId,
  onClosureChange,
  isEditing = false,
  currentInvoice,
  disabled = false
}) => {
  const [open, setOpen] = useState(false);
  const { closures, loading } = useClosuresForInvoices({ includeInvoiced: isEditing });
  const { clients } = useClients();

  const getClientName = (clientId?: string) => {
    if (!clientId) return 'Todos los clientes';
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Cliente desconocido';
  };

  const formatDateRange = (dateRange: { from: string; to: string }) => {
    const fromDate = new Date(dateRange.from).toLocaleDateString('es-CL');
    const toDate = new Date(dateRange.to).toLocaleDateString('es-CL');
    return `${fromDate} - ${toDate}`;
  };

  const selectedClosure = closures.find(c => c.id === selectedClosureId);

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>Cierre</Label>
        <div className="bg-muted rounded px-3 py-2">Cargando cierres...</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>
        Cierre
        {isEditing && (
          <span className="text-xs text-violet-600 ml-2">
            (Modo edición - incluye cierres facturados)
          </span>
        )}
      </Label>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} 
            disabled={disabled}
            className="w-full justify-between min-h-[60px] p-3">
            {selectedClosure ? (
              <div className="flex flex-col items-start text-left w-full">
                <div className="flex items-center gap-2 text-violet-600 font-medium">
                  <FileText className="w-4 h-4" />
                  {selectedClosure.folio}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDateRange(selectedClosure.dateRange)} • 
                  {getClientName(selectedClosure.clientId)} • 
                  ${Math.round(selectedClosure.total).toLocaleString()}
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground">Seleccionar cierre...</span>
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-[600px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar por folio, cliente o fecha..." />
            <CommandList className="max-h-[400px]">
              <CommandEmpty>No se encontraron cierres.</CommandEmpty>
              <CommandGroup>
                {closures.map(closure => (
                  <CommandItem
                    key={closure.id}
                    value={`${closure.folio} ${getClientName(closure.clientId)}`}
                    onSelect={() => {
                      onClosureChange(closure.id);
                      setOpen(false);
                    }}
                    className="p-0 cursor-pointer"
                  >
                    <div className="flex items-start justify-between w-full p-4 hover:bg-muted rounded-md">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          <span className="font-medium">{closure.folio}</span>
                          {selectedClosureId === closure.id && (
                            <Check className="w-4 h-4 text-primary ml-auto" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDateRange(closure.dateRange)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="w-4 h-4" />
                          <span>{getClientName(closure.clientId)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <DollarSign className="w-4 h-4 text-violet-600" />
                          <span className="font-medium text-violet-600">
                            ${Math.round(closure.total).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {disabled && (
        <p className="text-xs text-orange-400 mt-1">
          No se puede cambiar el cierre para facturas ya emitidas
        </p>
      )}
    </div>
  );
};

export default EnhancedClosureSelector;
```

### InvoiceCancellationModal.tsx

Modal de anulación con Nota de Crédito:

```typescript
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Ban, FileText, Building2, DollarSign } from 'lucide-react';
import { Invoice } from '@/types';
import { useInvoiceCancellation, CANCELLATION_REASONS } from '@/hooks/invoices/useInvoiceCancellation';

interface InvoiceCancellationModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  getClientName: (invoice: Invoice) => string;
}

export const InvoiceCancellationModal = ({
  invoice,
  isOpen,
  onClose,
  onSuccess,
  getClientName,
}: InvoiceCancellationModalProps) => {
  const [creditNoteNumber, setCreditNoteNumber] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [reasonDetails, setReasonDetails] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { cancelInvoice } = useInvoiceCancellation();

  const handleSubmit = async () => {
    if (!invoice || !creditNoteNumber.trim() || !cancellationReason || !confirmed) {
      return;
    }

    setIsSubmitting(true);
    try {
      await cancelInvoice({
        invoiceId: invoice.id,
        creditNoteNumber: creditNoteNumber.trim(),
        cancellationReason,
        reasonDetails: reasonDetails.trim() || undefined,
      });
      
      // Reset form
      setCreditNoteNumber('');
      setCancellationReason('');
      setReasonDetails('');
      setConfirmed(false);
      
      onSuccess();
      onClose();
    } catch (error) {
      // Error is handled in the hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = creditNoteNumber.trim() && cancellationReason && confirmed;

  if (!invoice) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Ban className="h-5 w-5" />
            Anular Factura con Nota de Crédito
          </DialogTitle>
          <DialogDescription>
            Esta acción registrará la anulación contable de la factura.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Invoice Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Factura:</span>
              <span>{invoice.folio}</span>
              {invoice.numeroFiscal && (
                <span className="text-violet-600 font-medium">({invoice.numeroFiscal})</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Cliente:</span>
              <span>{getClientName(invoice)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Total:</span>
              <span className="text-lg font-semibold">
                ${invoice.total.toLocaleString('es-CL')}
              </span>
            </div>
          </div>

          {/* Credit Note Number */}
          <div className="space-y-2">
            <Label htmlFor="creditNoteNumber">
              Número de Nota de Crédito <span className="text-destructive">*</span>
            </Label>
            <Input
              id="creditNoteNumber"
              value={creditNoteNumber}
              onChange={(e) => setCreditNoteNumber(e.target.value)}
              placeholder="Ej: NC-00001234"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Este número debe coincidir con el documento emitido en el SII
            </p>
          </div>

          {/* Cancellation Reason */}
          <div className="space-y-2">
            <Label>Motivo de Anulación <span className="text-destructive">*</span></Label>
            <Select value={cancellationReason} onValueChange={setCancellationReason}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar motivo..." />
              </SelectTrigger>
              <SelectContent>
                {CANCELLATION_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Additional Details */}
          <div className="space-y-2">
            <Label>Detalle adicional</Label>
            <Textarea
              value={reasonDetails}
              onChange={(e) => setReasonDetails(e.target.value)}
              placeholder="Descripción detallada del motivo de anulación..."
              rows={3}
            />
          </div>

          {/* Warning */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg p-3">
            <div className="flex gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium mb-1">Esta acción:</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>Cambiará el estado de la factura a "Anulada"</li>
                  <li>Los servicios quedarán disponibles para nueva factura</li>
                  <li>Se registrará el monto como rebaja contable</li>
                  <li><strong>NO se puede deshacer</strong></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <div className="flex items-start gap-3 bg-muted/30 rounded-lg p-3 border">
            <Checkbox
              id="confirmed"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
            />
            <Label htmlFor="confirmed" className="text-sm cursor-pointer leading-relaxed">
              Confirmo que la Nota de Crédito ha sido emitida en el sistema del SII 
              y los datos ingresados son correctos.
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={!isValid || isSubmitting}>
            {isSubmitting ? 'Procesando...' : 'Anular Factura'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

---

## Hooks Principales

### useInvoiceOperations.ts

Operaciones CRUD con transacciones:

```typescript
import { supabase } from '@/integrations/supabase/client';
import { Invoice } from '@/types';
import { toast } from 'sonner';
import { formatInvoiceData } from '@/utils/invoiceUtils';
import { useQueryClient } from '@tanstack/react-query';

export const useInvoiceOperations = () => {
  const queryClient = useQueryClient();

  const createInvoice = async (
    invoiceData: Omit<Invoice, 'id' | 'folio' | 'createdAt' | 'updatedAt'>
  ): Promise<Invoice> => {
    try {
      console.log('🚀 Starting invoice creation with transaction:', invoiceData);

      if (!invoiceData.closureId) {
        throw new Error('closureId es requerido para crear una factura');
      }

      // 1. Obtener servicios del cierre
      const { data: closureServices, error: closureError } = await supabase
        .from('closure_services')
        .select('service_id, services (id, folio, value)')
        .eq('closure_id', invoiceData.closureId);

      if (closureError) throw new Error('Error al obtener servicios del cierre');
      if (!closureServices || closureServices.length === 0) {
        throw new Error('No se encontraron servicios en el cierre');
      }

      const serviceIds = closureServices.map(cs => cs.service_id);

      // 2. Preparar datos para la transacción SQL
      const invoiceDataForTransaction = {
        client_id: invoiceData.clientId,
        issue_date: invoiceData.issueDate,
        due_date: invoiceData.dueDate,
        subtotal: invoiceData.subtotal.toString(),
        vat: invoiceData.vat.toString(),
        total: invoiceData.total.toString(),
        numero_fiscal: invoiceData.numeroFiscal,
        status: invoiceData.status || 'draft',
        payment_term_id: invoiceData.paymentTermId || '',
        notes: null
      };

      // 3. Usar función transaccional que maneja folio atómicamente
      const { data: transactionResult, error: transactionError } = await supabase
        .rpc('create_invoice_transaction', {
          p_invoice_data: invoiceDataForTransaction,
          p_service_ids: serviceIds
        });

      if (transactionError) {
        throw new Error(`Error al crear la factura: ${transactionError.message}`);
      }

      const result = transactionResult[0];
      if (!result?.invoice_id || !result?.invoice_folio) {
        throw new Error('Error en la transacción de factura: datos incompletos');
      }

      // 4. Obtener la factura creada
      const { data: newInvoice, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', result.invoice_id)
        .single();

      if (fetchError || !newInvoice) throw new Error('Error al obtener la factura creada');

      // 5. Crear relación invoice_closures
      const { error: closureRelationError } = await supabase
        .from('invoice_closures')
        .insert({
          invoice_id: newInvoice.id,
          closure_id: invoiceData.closureId
        });

      if (closureRelationError) throw new Error('Error al relacionar factura con cierre');

      // 6. Actualizar estado del cierre a 'invoiced'
      await supabase
        .from('service_closures')
        .update({ status: 'invoiced', updated_at: new Date().toISOString() })
        .eq('id', invoiceData.closureId);

      // 7. Invalidar queries de React Query
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services'] }),
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['closures'] })
      ]);

      // 8. Dispatch evento custom para otros listeners
      window.dispatchEvent(new CustomEvent('invoice-created', { 
        detail: { invoiceId: newInvoice.id, serviceIds } 
      }));

      toast.success("Factura creada", {
        description: `Factura ${result.invoice_folio} creada exitosamente.`,
      });

      return formatInvoiceData({ 
        ...newInvoice, 
        invoice_closures: [{ closure_id: invoiceData.closureId }] 
      });

    } catch (error: any) {
      console.error('❌ Error general en createInvoice:', error);
      toast.error("Error al crear factura", {
        description: error.message || "No se pudo crear la factura.",
      });
      throw error;
    }
  };

  const updateInvoice = async (id: string, invoiceData: Partial<Invoice>) => {
    // Validaciones, actualización con rollback, etc.
    // Ver código completo en el proyecto
  };

  const deleteInvoice = async (id: string) => {
    // Elimina factura y revierte estados de servicios/cierres
    // Ver código completo en el proyecto
  };

  const markAsPaid = async (id: string, paymentDate?: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ 
          status: 'paid', 
          payment_date: paymentDate || new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success("Factura marcada como pagada");
    } catch (error: any) {
      toast.error("Error al marcar como pagada", {
        description: error.message,
      });
      throw error;
    }
  };

  return { createInvoice, updateInvoice, deleteInvoice, markAsPaid };
};
```

### useClosuresForInvoices.ts

Obtiene cierres disponibles para facturar:

```typescript
import { useState, useEffect } from 'react';
import { ServiceClosure } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseClosuresForInvoicesProps {
  includeInvoiced?: boolean; // true para modo edición
}

export interface ClosureWithClient extends ServiceClosure {
  clientName?: string;
}

export const useClosuresForInvoices = ({ 
  includeInvoiced = false 
}: UseClosuresForInvoicesProps = {}) => {
  const [allClosures, setAllClosures] = useState<ClosureWithClient[]>([]);
  const [filteredClosures, setFilteredClosures] = useState<ClosureWithClient[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClosures = async () => {
    try {
      setLoading(true);
      
      // Query base: cierres cerrados (listos para facturar)
      let query = supabase
        .from('service_closures')
        .select(`
          *,
          clients:client_id (id, name)
        `)
        .order('created_at', { ascending: false });

      // En modo edición, incluir cierres ya facturados
      if (includeInvoiced) {
        query = query.in('status', ['closed', 'invoiced']);
      } else {
        query = query.eq('status', 'closed');
      }

      const { data, error } = await query;

      if (error) throw error;

      const formatted: ClosureWithClient[] = (data || []).map(closure => ({
        id: closure.id,
        folio: closure.folio,
        serviceIds: [], // Se obtienen de closure_services
        dateRange: { from: closure.date_from, to: closure.date_to },
        clientId: closure.client_id,
        clientName: closure.clients?.name,
        total: closure.total,
        status: closure.status,
        purchaseOrder: closure.purchase_order,
        createdAt: closure.created_at,
        updatedAt: closure.updated_at,
        createdBy: closure.created_by,
      }));

      setAllClosures(formatted);
    } catch (error) {
      console.error('Error fetching closures:', error);
      toast.error('Error al cargar cierres');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosures();
  }, [includeInvoiced]);

  // Filtrar cierres ya facturados (para modo creación)
  useEffect(() => {
    const filterClosures = async () => {
      if (includeInvoiced) {
        // En modo edición, mostrar todos
        setFilteredClosures(allClosures);
        return;
      }

      // En modo creación, excluir cierres ya facturados
      const { data: invoicedClosures } = await supabase
        .from('invoice_closures')
        .select('closure_id');

      const invoicedIds = new Set(invoicedClosures?.map(ic => ic.closure_id) || []);
      const available = allClosures.filter(c => !invoicedIds.has(c.id));
      
      setFilteredClosures(available);
    };

    filterClosures();
  }, [allClosures, includeInvoiced]);

  return {
    closures: filteredClosures,
    loading,
    refetch: fetchClosures
  };
};
```

### useInvoiceCancellation.ts

Sistema de anulación con Nota de Crédito:

```typescript
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export interface CancellationData {
  invoiceId: string;
  creditNoteNumber: string;
  cancellationReason: string;
  reasonDetails?: string;
}

export const CANCELLATION_REASONS = [
  { value: 'error_datos_cliente', label: 'Error en datos del cliente' },
  { value: 'error_montos', label: 'Error en montos facturados' },
  { value: 'servicio_no_prestado', label: 'Servicio no prestado' },
  { value: 'duplicado', label: 'Duplicado de factura' },
  { value: 'solicitud_cliente', label: 'Solicitud del cliente' },
  { value: 'otro', label: 'Otro (especificar en detalles)' },
];

export const useInvoiceCancellation = () => {
  const queryClient = useQueryClient();

  const cancelInvoice = async (data: CancellationData): Promise<void> => {
    try {
      // 1. Obtener datos de la factura
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('id, folio, numero_fiscal, total, client_id, status')
        .eq('id', data.invoiceId)
        .single();

      if (invoiceError || !invoice) throw new Error('Factura no encontrada');
      if (invoice.status === 'cancelled') throw new Error('Factura ya está anulada');

      // 2. Verificar que NC no esté duplicada
      const { data: existingNC } = await supabase
        .from('invoice_cancellations')
        .select('id')
        .eq('credit_note_number', data.creditNoteNumber)
        .maybeSingle();

      if (existingNC) throw new Error('Este número de Nota de Crédito ya está registrado');

      // 3. Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser();

      // 4. Crear registro de anulación
      await supabase
        .from('invoice_cancellations')
        .insert({
          invoice_id: data.invoiceId,
          credit_note_number: data.creditNoteNumber,
          cancellation_reason: data.cancellationReason,
          reason_details: data.reasonDetails || null,
          cancelled_by: user?.id || null,
          original_folio: invoice.folio,
          original_numero_fiscal: invoice.numero_fiscal,
          original_total: invoice.total,
          original_client_id: invoice.client_id,
        });

      // 5. Actualizar estado de la factura a cancelled
      await supabase
        .from('invoices')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', data.invoiceId);

      // 6. Obtener cierres relacionados
      const { data: invoiceClosures } = await supabase
        .from('invoice_closures')
        .select('closure_id')
        .eq('invoice_id', data.invoiceId);

      const closureIds = invoiceClosures?.map(ic => ic.closure_id) || [];

      if (closureIds.length > 0) {
        // 7. Obtener servicios de los cierres
        const { data: closureServices } = await supabase
          .from('closure_services')
          .select('service_id')
          .in('closure_id', closureIds);

        const serviceIds = closureServices?.map(cs => cs.service_id) || [];

        // 8. Revertir estado de servicios a 'completed'
        if (serviceIds.length > 0) {
          await supabase
            .from('services')
            .update({ 
              status: 'completed', 
              invoice_folio: null,
              invoice_numero_fiscal: null,
              updated_at: new Date().toISOString() 
            })
            .in('id', serviceIds)
            .eq('status', 'invoiced');
        }

        // 9. Revertir estado de cierres a 'closed'
        await supabase
          .from('service_closures')
          .update({ status: 'closed', updated_at: new Date().toISOString() })
          .in('id', closureIds);

        // 10. Eliminar relación invoice_closures (libera cierre para re-facturación)
        await supabase
          .from('invoice_closures')
          .delete()
          .eq('invoice_id', data.invoiceId);
      }

      // 11. Invalidar queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['services'] }),
        queryClient.invalidateQueries({ queryKey: ['closures'] }),
        queryClient.invalidateQueries({ queryKey: ['invoice-cancellations'] })
      ]);

      toast.success("Factura anulada correctamente", {
        description: `NC ${data.creditNoteNumber} registrada. Servicios disponibles para nueva facturación.`,
      });

    } catch (error: any) {
      console.error('❌ Error en anulación:', error);
      toast.error("Error al anular factura", {
        description: error.message,
      });
      throw error;
    }
  };

  const fetchCancellations = async () => {
    const { data, error } = await supabase
      .from('invoice_cancellations')
      .select(`
        *,
        clients:original_client_id (name),
        profiles:cancelled_by (full_name)
      `)
      .order('cancelled_at', { ascending: false });

    if (error) throw error;
    return data;
  };

  return { cancelInvoice, fetchCancellations };
};
```

### usePaymentTerms.ts

Condiciones de pago:

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PaymentTerm } from '@/types';
import { toast } from 'sonner';

export const usePaymentTerms = () => {
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPaymentTerms = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_terms')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setPaymentTerms(data || []);
    } catch (error) {
      console.error('Error fetching payment terms:', error);
      toast.error('Error al cargar condiciones de pago');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentTerms();
  }, []);

  return {
    paymentTerms,
    loading,
    refetch: fetchPaymentTerms
  };
};
```

---

## Utilidades

### invoiceUtils.ts

```typescript
import { Invoice } from '@/types';
import { supabase } from '@/integrations/supabase/client';

// Conversiones seguras
export const safeNumber = (value: any, fallback: number = 0): number => {
  const num = Number(value);
  return isNaN(num) ? fallback : num;
};

export const safeString = (value: any, fallback: string = ''): string => {
  return value === null || value === undefined ? fallback : String(value);
};

export const safeDate = (value: any): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
};

// Detectar facturas vencidas
export const shouldBeOverdue = (status: string, dueDate: string): boolean => {
  if (status !== 'sent') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return due < today;
};

// Actualizar facturas vencidas en BD
export const updateOverdueInvoices = async (invoiceIds: string[]): Promise<void> => {
  if (invoiceIds.length === 0) return;
  
  await supabase
    .from('invoices')
    .update({ status: 'overdue', updated_at: new Date().toISOString() })
    .in('id', invoiceIds);
};

// Formatear datos de Supabase a interface Invoice
export const formatInvoiceData = (data: any): Invoice => {
  const status = shouldBeOverdue(data.status, data.due_date) ? 'overdue' : data.status;
  
  return {
    id: data.id,
    folio: safeString(data.folio),
    closureId: data.invoice_closures?.[0]?.closure_id || null,
    clientId: data.client_id,
    issueDate: safeDate(data.issue_date) || '',
    dueDate: safeDate(data.due_date) || '',
    subtotal: safeNumber(data.subtotal),
    vat: safeNumber(data.vat),
    total: safeNumber(data.total),
    status: status as Invoice['status'],
    paymentDate: safeDate(data.payment_date),
    paymentTermId: data.payment_term_id,
    numeroFiscal: data.numero_fiscal,
    paidAmount: safeNumber(data.paid_amount),
    remainingAmount: safeNumber(data.remaining_amount),
    notes: data.notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    createdBy: data.created_by,
    client: data.client,
    creator: data.creator,
  };
};

// Generar folio de factura
export const generateInvoiceFolio = async (): Promise<string> => {
  const { data, error } = await supabase.rpc('preview_next_invoice_folio');
  if (error) throw error;
  return data;
};

// Validar datos de factura
export const validateInvoiceData = (
  invoiceData: Partial<Invoice>
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (invoiceData.issueDate && invoiceData.dueDate) {
    const issue = new Date(invoiceData.issueDate);
    const due = new Date(invoiceData.dueDate);
    if (due <= issue) {
      errors.push('La fecha de vencimiento debe ser posterior a la fecha de emisión');
    }
  }

  if (invoiceData.subtotal !== undefined && invoiceData.subtotal < 0) {
    errors.push('El subtotal no puede ser negativo');
  }

  if (invoiceData.total !== undefined && invoiceData.total < 0) {
    errors.push('El total no puede ser negativo');
  }

  return { isValid: errors.length === 0, errors };
};
```

---

## Esquema de Base de Datos

```sql
-- Enum para estados de factura
CREATE TYPE invoice_status AS ENUM (
  'draft',     -- Borrador
  'sent',      -- Enviada
  'paid',      -- Pagada
  'overdue',   -- Vencida
  'cancelled'  -- Anulada
);

-- Tabla principal de facturas
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT UNIQUE NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id),
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  vat NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status invoice_status DEFAULT 'draft',
  payment_date DATE,
  payment_term_id UUID REFERENCES payment_terms(id),
  numero_fiscal TEXT,
  paid_amount NUMERIC DEFAULT 0,
  remaining_amount NUMERIC GENERATED ALWAYS AS (total - paid_amount) STORED,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Relación facturas-cierres (many-to-many)
CREATE TABLE invoice_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  closure_id UUID NOT NULL REFERENCES service_closures(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(invoice_id, closure_id)
);

-- Historial de anulaciones
CREATE TABLE invoice_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID UNIQUE NOT NULL REFERENCES invoices(id),
  credit_note_number TEXT UNIQUE NOT NULL,
  cancellation_reason TEXT NOT NULL,
  reason_details TEXT,
  cancelled_by UUID REFERENCES profiles(id),
  cancelled_at TIMESTAMPTZ DEFAULT now(),
  original_folio TEXT NOT NULL,
  original_numero_fiscal TEXT,
  original_total NUMERIC NOT NULL,
  original_client_id UUID REFERENCES clients(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Condiciones de pago
CREATE TABLE payment_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  days INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoice_closures_invoice ON invoice_closures(invoice_id);
CREATE INDEX idx_invoice_closures_closure ON invoice_closures(closure_id);
CREATE INDEX idx_invoice_cancellations_invoice ON invoice_cancellations(invoice_id);

-- RLS Policies
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view invoices" 
ON invoices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert invoices" 
ON invoices FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update invoices" 
ON invoices FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete invoices" 
ON invoices FOR DELETE TO authenticated USING (true);

-- Similar policies for other tables...
```

### Funciones SQL Críticas

```sql
-- Función transaccional para crear factura con folio atómico
CREATE OR REPLACE FUNCTION create_invoice_transaction(
  p_invoice_data JSONB,
  p_service_ids UUID[]
)
RETURNS TABLE(invoice_id UUID, invoice_folio TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_folio TEXT;
  v_invoice_id UUID;
  v_next_number INTEGER;
BEGIN
  -- Obtener siguiente número de folio de forma atómica
  SELECT next_invoice_folio_number INTO v_next_number 
  FROM company_data 
  FOR UPDATE;
  
  v_folio := 'FAC-' || LPAD(v_next_number::TEXT, 3, '0');
  
  -- Incrementar contador
  UPDATE company_data 
  SET next_invoice_folio_number = next_invoice_folio_number + 1;
  
  -- Insertar factura
  INSERT INTO invoices (
    folio, client_id, issue_date, due_date, 
    subtotal, vat, total, numero_fiscal, 
    status, payment_term_id, created_by
  )
  VALUES (
    v_folio,
    (p_invoice_data->>'client_id')::UUID,
    (p_invoice_data->>'issue_date')::DATE,
    (p_invoice_data->>'due_date')::DATE,
    (p_invoice_data->>'subtotal')::NUMERIC,
    (p_invoice_data->>'vat')::NUMERIC,
    (p_invoice_data->>'total')::NUMERIC,
    p_invoice_data->>'numero_fiscal',
    (p_invoice_data->>'status')::invoice_status,
    NULLIF(p_invoice_data->>'payment_term_id', '')::UUID,
    auth.uid()
  )
  RETURNING id INTO v_invoice_id;
  
  -- Insertar relaciones invoice_services
  INSERT INTO invoice_services (invoice_id, service_id)
  SELECT v_invoice_id, unnest(p_service_ids);
  
  -- Actualizar servicios a 'invoiced' y propagar folio
  UPDATE services
  SET status = 'invoiced',
      invoice_folio = v_folio,
      invoice_numero_fiscal = p_invoice_data->>'numero_fiscal',
      updated_at = now()
  WHERE id = ANY(p_service_ids);
  
  RETURN QUERY SELECT v_invoice_id, v_folio;
END;
$$;

-- Trigger para propagar folio de factura a servicios
CREATE OR REPLACE FUNCTION propagate_invoice_folio()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.folio IS DISTINCT FROM OLD.folio OR 
     NEW.numero_fiscal IS DISTINCT FROM OLD.numero_fiscal THEN
    UPDATE services
    SET invoice_folio = NEW.folio,
        invoice_numero_fiscal = NEW.numero_fiscal,
        updated_at = now()
    WHERE id IN (
      SELECT service_id FROM invoice_services WHERE invoice_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_propagate_invoice_folio
AFTER UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION propagate_invoice_folio();
```

---

## Dependencias

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.56.2",
    "@supabase/supabase-js": "^2.50.0",
    "react-hook-form": "^7.53.0",
    "@hookform/resolvers": "^3.9.0",
    "zod": "^3.23.8",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.462.0",
    "sonner": "^1.5.0"
  }
}
```

---

## Estructura de Archivos Recomendada

```
src/
├── components/
│   └── invoices/
│       ├── form/
│       │   ├── InvoiceFormStep1.tsx
│       │   ├── InvoiceFormStep2.tsx
│       │   ├── InvoiceFormStep3.tsx
│       │   ├── InvoiceFormStepNavigation.tsx
│       │   └── InvoiceSummaryPanel.tsx
│       ├── InvoiceForm.tsx
│       ├── EnhancedClosureSelector.tsx
│       ├── InvoicesTable.tsx
│       ├── InvoicesStats.tsx
│       ├── InvoiceCancellationModal.tsx
│       ├── InvoiceSummary.tsx
│       ├── InvoicesPipelineView.tsx
│       ├── InvoiceAlertsDashboard.tsx
│       ├── PaymentReconciliation.tsx
│       └── CancellationsHistory.tsx
├── hooks/
│   ├── invoices/
│   │   ├── useInvoiceData.ts
│   │   ├── useInvoiceOperations.ts
│   │   ├── useInvoiceFormData.ts
│   │   └── useInvoiceCancellation.ts
│   ├── useInvoices.ts
│   ├── useClosuresForInvoices.ts
│   ├── usePaymentTerms.ts
│   └── useInvoiceAlerts.ts
├── utils/
│   └── invoiceUtils.ts
├── pages/
│   └── Invoices.tsx
└── types/
    └── index.ts
```

---

## Patrones y Buenas Prácticas

### Patrón Anti-Submit Accidental

```typescript
// ❌ INCORRECTO - puede enviar al presionar Enter
<form onSubmit={handleSubmit}>
  <Button type="submit">Crear</Button>
</form>

// ✅ CORRECTO - control explícito
<div>
  <Button type="button" onClick={handleSubmit(onSubmit)}>
    Crear Factura
  </Button>
</div>
```

### Validación con Zod

```typescript
const invoiceSchema = z.object({
  closureId: z.string().min(1, 'Debe seleccionar un cierre'),
  issueDate: z.string().min(1, 'Fecha de emisión es requerida'),
  dueDate: z.string().min(1, 'Fecha de vencimiento es requerida'),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  paymentTermId: z.string().optional(),
  paymentDate: z.string().optional(),
  numeroFiscal: z.string().optional()
});
```

### Transacciones Atómicas

Usar funciones SQL con `FOR UPDATE` para garantizar folio único:

```sql
SELECT next_invoice_folio_number INTO v_next_number 
FROM company_data 
FOR UPDATE; -- Lock para evitar folios duplicados
```

### Invalidación de Cache con React Query

```typescript
await Promise.all([
  queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  queryClient.invalidateQueries({ queryKey: ['services'] }),
  queryClient.invalidateQueries({ queryKey: ['closures'] })
]);
```

### Eventos Custom para Sincronización

```typescript
// Emisor
window.dispatchEvent(new CustomEvent('invoice-created', { 
  detail: { invoiceId, serviceIds } 
}));

// Receptor
useEffect(() => {
  const handler = (e: CustomEvent) => {
    console.log('Invoice created:', e.detail);
    refetch();
  };
  window.addEventListener('invoice-created', handler);
  return () => window.removeEventListener('invoice-created', handler);
}, []);
```

---

## Notas de Implementación

1. **Relación con Cierres**: Las facturas SIEMPRE se crean desde un cierre en estado "closed"
2. **IVA 19%**: Cálculo automático e inmutable
3. **Folio secuencial**: FAC-001, FAC-002... generado atómicamente
4. **Propagación de folio**: Al crear/editar factura, el folio se propaga a todos los servicios
5. **Anulación con NC**: No permite eliminación física, solo anulación contable
6. **Vencimiento automático**: Facturas "sent" pasada su fecha de vencimiento cambian a "overdue"
7. **Formato moneda**: `toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })`

---

## Versión

**v4.0** - Enero 2025

Este prompt está diseñado para replicar el módulo de facturación en cualquier proyecto React + TypeScript + Supabase + shadcn/ui.
