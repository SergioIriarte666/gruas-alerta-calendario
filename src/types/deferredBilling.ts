export interface DeferredBillingSummary {
  readyForBilling: number;
  pendingDeferred: number;
  totalPendingAmount: number;
  clientsWithDeferredBilling: number;
}

export interface ServiceReadyForBilling {
  id: string;
  clientId: string;
  clientName: string;
  serviceMonth: string;
  serviceCount: number;
  totalValue: number;
  billingReadyDate: string;
  billingCycleType: 'immediate' | 'deferred';
  billingDelayDays: number;
  billingCycleDay?: number;
  autoInvoiceGeneration: boolean;
  servicePeriod: string;
}

export interface ClientBillingConfig {
  billingCycleType: 'immediate' | 'deferred';
  billingDelayDays: number;
  billingCycleDay?: number;
  autoInvoiceGeneration: boolean;
  billingNotes?: string;
}

export interface DeferredBillingCalendarEvent {
  id: string;
  clientId: string;
  clientName: string;
  serviceCount: number;
  totalAmount: number;
  billingDate: string;
  isOverdue: boolean;
  autoGeneration: boolean;
}