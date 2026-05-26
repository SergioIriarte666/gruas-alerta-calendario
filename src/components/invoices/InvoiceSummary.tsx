
interface InvoiceSummaryProps {
  subtotal: number;
  vat: number;
  total: number;
}

const InvoiceSummary = ({ subtotal, vat, total }: InvoiceSummaryProps) => {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
      <h4 className="mb-3 font-medium text-foreground">Resumen de Facturación</h4>
      <div className="space-y-2 text-foreground">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>${Math.round(subtotal).toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>IVA (19%):</span>
          <span>${Math.round(vat).toLocaleString()}</span>
        </div>
        <div className="flex justify-between border-t border-border/70 pt-2 text-lg font-bold">
          <span>Total:</span>
          <span>${Math.round(total).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default InvoiceSummary;
