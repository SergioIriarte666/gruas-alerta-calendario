import { useEffect, useState } from 'react';
import { createReceiptSignedUrls } from '@/services/receiptPhotos';

export function ReceiptPhotoAttachments({ paths, isOpen }: { paths: string[]; isOpen: boolean }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const pathsKey = paths.join('|');
  useEffect(() => {
    let active = true;
    setUrls([]); setError(false);
    if (!isOpen || !pathsKey) return;
    void createReceiptSignedUrls(pathsKey.split('|')).then(({ data, error: storageError }) => {
      if (!active) return;
      setError(!!storageError || (data || []).some(item => !!item.error));
      setUrls((data || []).flatMap(item => item.signedUrl ? [item.signedUrl] : []));
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [isOpen, pathsKey]);
  if (!paths.length) return null;
  return <section className="space-y-2 rounded-xl border p-3" aria-label="Respaldo de la compra">
    <h3 className="text-sm font-semibold">Foto de respaldo de la compra</h3>
    {error && <p className="text-sm text-destructive">No se pudo abrir el respaldo. Reabre el detalle o revisa tus permisos.</p>}
    <div className="flex flex-wrap gap-3">{urls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="space-y-1 text-sm text-primary"><img src={url} alt={`Factura fotografiada ${index + 1}`} className="h-36 max-w-full rounded-lg border object-contain" /><span>Abrir foto {index + 1}</span></a>)}</div>
  </section>;
}
