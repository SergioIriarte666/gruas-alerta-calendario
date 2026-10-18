import { ClipboardCheck, Truck, Warehouse, Wallet, Tags } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { useXmlInventoryUpload } from '@/hooks/xml/useXmlInventoryUpload';
import { resolveLineConsumption } from '@/utils/xml/xmlInventoryConsumption';
import { resolveLineSubcategoryId } from '@/utils/xml/xmlInventoryClassification';
import { computeLineSubtotal, computeLineTaxAmount, formatCurrency } from '@/utils/xml/xmlInventoryHelpers';

export function InventoryImportReview({ upload }: { upload: ReturnType<typeof useXmlInventoryUpload> }) {
  const { selectedValidatedDocuments, discardedLines, lineConsumptions, lineCostSubcategories, selectedCostSubcategory,
    costSubcategories, cranes, classificationSummary, selectedLocation, selectedCostCategory, selectedCostCenter,
    isPaid, paymentDate, paymentReference, dueDateOverride, selectedOperator, selectedService, selectedServiceFolio, importNotes } = upload;
  const total = selectedValidatedDocuments.reduce((sum, document) => sum + document.doc.total_amount, 0);
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-border/70">
        <CardHeader className="border-b bg-muted/20 py-4"><CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="size-4 text-primary" />Revisión de la compra</CardTitle></CardHeader>
        <CardContent className="grid gap-5 pt-4 md:grid-cols-2">
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium"><Tags className="size-4 text-primary" />Clasificación · importes netos</p>
            <p className="text-sm">{selectedCostCategory?.name} · {selectedCostCenter?.name || 'Sin centro de costo'}</p>
            {classificationSummary.map(group => <div key={group.name} className="flex justify-between gap-3 text-sm"><span>{group.name} ({group.lineCount})</span><span className="tabular-nums">{formatCurrency(group.netAmount)}</span></div>)}
            <p className="text-xs text-muted-foreground">Cada factura conserva un solo costo consolidado y el detalle por producto.</p>
          </div>
          <div className="space-y-3 rounded-xl bg-primary/5 p-4">
            <div className="flex justify-between gap-3 text-lg font-semibold"><span>Total a importar</span><span className="tabular-nums">{formatCurrency(total)}</span></div>
            <div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm"><Wallet className="size-4" />Estado de pago</p><Badge variant={isPaid ? 'default' : 'outline'}>{isPaid ? 'Pagada' : 'Pendiente'}</Badge></div>
            {isPaid ? <><p className="text-sm">Fecha de pago: {paymentDate}</p>{paymentReference.trim() && <p className="break-words text-sm">Referencia: {paymentReference}</p>}</> : <p className="text-sm">Saldo por pagar: {formatCurrency(total)}</p>}
            <p className="text-sm">Bodega: {selectedLocation?.name}</p>
          </div>
        </CardContent>
      </Card>
      {selectedValidatedDocuments.map(document => {
        const lines = document.lines.filter(line => !discardedLines.has(line.key));
        const net = document.doc.net_amount ?? lines.reduce((sum, line) => sum + computeLineSubtotal(line.item), 0);
        const tax = document.doc.vat_amount ?? lines.reduce((sum, line) => sum + computeLineTaxAmount(line.item), 0);
        return <Card key={document.doc.folio} className="overflow-hidden border-border/70">
          <CardHeader className="border-b bg-muted/20 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">Factura {document.doc.folio} · {document.supplier?.name || 'Proveedor XML'}</CardTitle><Badge variant="secondary">{formatCurrency(document.doc.total_amount)}</Badge></div>
            <p className="text-xs text-muted-foreground">Neto {formatCurrency(net)} · IVA {formatCurrency(tax)} · Vencimiento {dueDateOverride || document.doc.due_date || document.doc.issue_date}</p>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {lines.map(line => {
              const consumption = resolveLineConsumption(Number(line.item.quantity), lineConsumptions[line.key]);
              const subcategoryId = resolveLineSubcategoryId(lineCostSubcategories[line.key], selectedCostSubcategory, costSubcategories);
              const subcategory = costSubcategories.find(item => item.id === subcategoryId)?.name || 'Sin subcategoría';
              const crane = cranes.find(item => item.id === consumption.craneId);
              return <div key={line.key} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap justify-between gap-2"><p className="min-w-0 break-words text-sm font-medium">{line.item.description}</p><Badge variant="outline">{subcategory}</Badge></div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  {consumption.immediate && <p className="flex items-center gap-2"><Truck className="size-4 shrink-0 text-primary" />{consumption.quantity} un. → {crane?.licensePlate || 'Falta grúa'}</p>}
                  {(!consumption.immediate || consumption.quantity < Number(line.item.quantity)) && <p className="flex items-center gap-2"><Warehouse className="size-4 shrink-0 text-primary" />{Number(line.item.quantity) - (consumption.immediate ? consumption.quantity : 0)} un. → {selectedLocation?.name}</p>}
                </div>
              </div>;
            })}
          </CardContent>
        </Card>;
      })}
      {(selectedService || selectedOperator || selectedServiceFolio || importNotes.trim()) && <Card><CardContent className="space-y-2 pt-4 text-sm">
        {selectedService && <p>Servicio: {selectedService.folio}</p>}
        {selectedOperator && <p>Operador: {selectedOperator.name}</p>}
        {selectedServiceFolio && <p>Folio de servicio: {selectedServiceFolio}</p>}
        {importNotes.trim() && <p className="whitespace-pre-wrap break-words">Observaciones: {importNotes}</p>}
      </CardContent></Card>}
    </div>
  );
}
