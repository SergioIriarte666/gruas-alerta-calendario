import { Invoice } from '@/types';
import { InvoiceCard } from './InvoiceCard';

interface InvoicesCardsViewProps {
  invoices: Invoice[];
  onEdit: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (id: string) => void;
  getInvoiceWithDetails: (invoice: Invoice) => any;
}

export const InvoicesCardsView = ({
  invoices,
  onEdit,
  onDelete,
  onMarkAsPaid,
  getInvoiceWithDetails
}: InvoicesCardsViewProps) => {
  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
        <p className="text-muted-foreground">No se encontraron facturas</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {invoices.map(invoice => {
        const details = getInvoiceWithDetails(invoice);
        return (
          <InvoiceCard
            key={invoice.id}
            invoice={invoice}
            clientName={details.client?.name}
            onEdit={onEdit}
            onDelete={onDelete}
            onMarkAsPaid={onMarkAsPaid}
          />
        );
      })}
    </div>
  );
};

export default InvoicesCardsView;
