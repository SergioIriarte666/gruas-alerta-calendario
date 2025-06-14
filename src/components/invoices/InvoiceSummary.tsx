
interface InvoiceSummaryProps {
  subtotal: number;
  vat: number;
  total: number;
}

const InvoiceSummary = ({ subtotal, vat, total }: InvoiceSummaryProps) => {
  return (
    <div className="bg-white/10 p-4 rounded-lg border border-gray-700">
      <h4 className="font-medium text-white mb-3">Resumen de Facturación</h4>
      <div className="space-y-2">
        <div className="flex justify-between text-gray-300">
          <span>Subtotal:</span>
          <span>${subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span>IVA (19%):</span>
          <span>${vat.toLocaleString()}</span>
        </div>
        <div className="flex justify-between font-bold text-lg border-t border-gray-700 pt-2 text-white">
          <span>Total:</span>
          <span>${total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default InvoiceSummary;
