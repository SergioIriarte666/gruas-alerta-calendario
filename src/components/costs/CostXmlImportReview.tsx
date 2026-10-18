import React from 'react';
import type { useXmlCostUpload } from '@/hooks/xml/useXmlCostUpload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getDocumentStateKey } from '@/utils/xml/xmlGlosaHelpers';
import { summarizeInvoiceClassifications } from '@/utils/xml/xmlInventoryClassification';
import { formatCurrency } from '@/utils/xml/xmlInventoryHelpers';

export function CostXmlImportReview({ upload }: { upload: ReturnType<typeof useXmlCostUpload> }) {
  return <div className="space-y-4">
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <h3 className="font-semibold">Revisa antes de registrar</h3>
      <p className="mt-1 text-sm text-muted-foreground">Un costo consolidado por factura. Sus productos mantienen la clasificación individual en el detalle.</p>
    </div>
    {upload.uploadableDocuments.map(document => {
      const key = getDocumentStateKey(document);
      const supplier = upload.parseResult?.suppliers.find(supplier => supplier.rut === document.supplier_rut);
      const category = upload.activeCategories.find(category => category.id === upload.resolveCategoryId(upload.supplierCategoryMapping[document.supplier_rut]));
      const items = upload.getClassifiedItems(document);
      const linked = upload.linkDecisions[key] && upload.linkDecisions[key] !== 'new';
      const isPaid = !!upload.paidOverrides[key];
      const crane = upload.lowboyCraneOptions.find(crane => crane.id === upload.craneIdByDocument[key]);
      return <Card key={key}>
        <CardHeader className="space-y-2 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Factura {document.folio} · {supplier?.name || document.supplier_rut}</CardTitle>
            <strong>{formatCurrency(upload.getDocumentAmount(document))}</strong>
          </div>
          <div className="flex flex-wrap gap-2"><Badge variant="outline">{category?.name}</Badge>
            <Badge variant={isPaid ? 'default' : 'outline'}>{isPaid ? `Pagado · ${upload.paidDateOverrides[key]}` : 'Pendiente de pago'}</Badge>
            <Badge variant="outline">{linked ? 'Vincular a costo existente' : 'Crear costo consolidado'}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="break-words">{upload.getEffectiveGlosa(document)}</p>
          <p className="text-muted-foreground">Vencimiento: {upload.getDocumentDueDate(document)} · {items.length} de {document.items?.length || 0} productos incluidos</p>
          <div className="rounded-lg border p-3">
            <p className="mb-2 font-medium">Clasificación por producto · importes netos</p>
            {summarizeInvoiceClassifications(items.map(item => ({ cost_subcategory: item.cost_subcategory, subtotal: item.subtotal ?? item.quantity * item.unit_price }))).map(group =>
              <div key={group.name} className="flex flex-wrap justify-between gap-2 py-1"><span>{group.name} · {group.lineCount} producto(s)</span><strong>{formatCurrency(group.netAmount)}</strong></div>)}
            {!items.length && <p className="text-muted-foreground">El XML no contiene líneas de detalle.</p>}
          </div>
          {upload.getDocumentEntity(document) === 'lowboy' && <p>LowBoy · {crane?.label || 'Sin equipo asignado'} · Financiado por {upload.paidByDocument[key] === 'lowboy' ? 'LowBoy' : 'Grúas 5 Norte'}</p>}
          <p className="text-muted-foreground">{linked ? 'La vinculación no crea movimientos de inventario.' : upload.syncToInventory ? `Sincronización consolidada con Bodega${crane ? ' y consumo al equipo asignado' : ''}. No distribuye productos entre varias grúas.` : 'Sin movimientos de inventario.'}</p>
        </CardContent>
      </Card>;
    })}
  </div>;
}
