import { useRef, useState } from 'react';
import { Cloud, Loader2 } from 'lucide-react';
import { checkPurchaseReceiptPhotos, migratePurchaseReceiptPhotos } from '@/services/receiptPhotos';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function PurchaseReceiptMigrationDialog({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [copied, setCopied] = useState(0);
  const [failures, setFailures] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const running = useRef(false);
  const migrate = async () => {
    if (running.current) return;
    running.current = true; setBusy(true); setStarted(true); setError('');
    let after = cursor || '';
    if (!cursor) { setCopied(0); setFailures([]); }
    try {
      await checkPurchaseReceiptPhotos();
      for (let batch = 0; batch < 20; batch++) {
        const result = await migratePurchaseReceiptPhotos(after);
        setCopied(previous => previous + result.results.filter(item => item.migrated).length);
        setFailures(previous => [...previous, ...result.results.filter(item => !item.migrated).map(item => `${item.path}: ${item.error || 'Traslado pendiente'}`)]);
        setCursor(result.nextCursor);
        if (!result.nextCursor) break;
        after = result.nextCursor;
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo completar el traslado. Puedes reintentar.'); }
    finally { running.current = false; setBusy(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="finance-dialog max-h-[90dvh] overflow-y-auto sm:max-w-xl">
    <DialogHeader><DialogTitle className="flex items-center gap-2"><Cloud className="size-5 text-primary" />Respaldos de compras en Cloudflare</DialogTitle><DialogDescription>Bucket privado: g5n-comprobantes-compras.</DialogDescription></DialogHeader>
    <Alert><AlertDescription>Traslada únicamente las fotos JPEG de compras desde foto/manual que todavía están en Supabase. Verifica tamaño y contenido SHA-256 en R2 antes de eliminar cada original. No modifica facturas, costos, inspecciones ni respaldos de base de datos.</AlertDescription></Alert>
    <p className="text-sm text-muted-foreground">Primero se comprueba el acceso de lectura, escritura y eliminación en el bucket nuevo. Las fotos nuevas se guardan directamente en R2. Las anteriores siguen disponibles durante el traslado. Mantén abierta esta ventana; si hay un error, el original no verificado se conserva y puedes reintentar.</p>
    {started && <p role="status" className="text-sm">{copied} respaldo(s) trasladado(s) y verificado(s) · {failures.length} pendiente(s){busy ? ' · Procesando…' : cursor ? ' · Quedan más archivos por procesar.' : !error ? ' · Lote finalizado.' : ''}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {failures.length > 0 && <details className="text-sm"><summary>Ver pendientes</summary><ul className="mt-2 space-y-2 break-all">{failures.map((failure, index) => <li key={index}>{failure}</li>)}</ul></details>}
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cerrar</Button><Button disabled={busy} onClick={() => void migrate()}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}{busy ? 'Verificando y trasladando…' : cursor ? 'Continuar traslado' : started ? 'Revisar pendientes y reintentar' : 'Trasladar respaldos anteriores a R2'}</Button></div>
  </DialogContent></Dialog>;
}
