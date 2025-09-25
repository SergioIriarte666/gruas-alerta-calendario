
interface InvoiceSummaryProps {
  subtotal: number;
  vat: number;
  total: number;
}

const InvoiceSummary = ({ subtotal, vat, total }: InvoiceSummaryProps) => {
  return (
    <div className="bg-white/10 p-4 rounded-lg border border-gray-700">
      <h4 className="font-medium text-white mb-3">Resumen de Facturación</h4>
      <div className="space-y-2 text-black">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>${Math.round(subtotal).toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>IVA (19%):</span>
          <span>${Math.round(vat).toLocaleString()}</span>
        </div>
        <div className="flex justify-between font-bold text-lg border-t border-gray-700 pt-2">
          <span>Total:</span>
          <span>${Math.round(total).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default InvoiceSummary;
