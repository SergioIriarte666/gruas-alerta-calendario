import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { emptyManualPurchase, draftFromReceiptExtraction, type ManualPurchaseDraft } from '@/utils/manualPurchase';
import { extractPurchasePhoto, preparePurchasePhoto } from '@/services/manualPurchase';

export function useManualPurchaseDraft() {
  const [draft, setDraft] = useState(emptyManualPurchase);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    if (!photo) { setPhotoUrl(''); return; }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  useEffect(() => () => { generation.current += 1; }, []);

  const choosePhoto = async (file: File) => {
    const current = ++generation.current;
    setPhotoBusy(true);
    setPhoto(null);
    setDraft(emptyManualPurchase());
    setPhotoError('');
    try {
      const prepared = await preparePurchasePhoto(file);
      if (current === generation.current) setPhoto(prepared);
    } catch {
      if (current === generation.current) setPhotoError('No se pudo preparar esta foto. Intenta JPG/PNG o vuelve a tomarla. Puedes ingresar los datos manualmente.');
    } finally {
      if (current === generation.current) setPhotoBusy(false);
    }
  };
  const readPhoto = async () => {
    if (!photo || extracting) return;
    const current = generation.current;
    setExtracting(true);
    setPhotoError('');
    try {
      const data = await extractPurchasePhoto(photo);
      if (current !== generation.current) return;
      setDraft(draftFromReceiptExtraction(data));
      toast.info('Datos precargados. Verifica proveedor, fechas, productos, precios netos e IVA antes de continuar.');
    } catch (error) {
      if (current === generation.current) setPhotoError(error instanceof Error ? error.message : 'No se pudo leer la imagen.');
    } finally {
      if (current === generation.current) setExtracting(false);
    }
  };
  const reset = () => {
    generation.current += 1;
    setDraft(emptyManualPurchase()); setPhoto(null); setPhotoBusy(false); setExtracting(false); setPhotoError('');
  };
  const changeDraft = (value: ManualPurchaseDraft) => setDraft(value);
  const removePhoto = () => { generation.current += 1; setPhoto(null); setPhotoError(''); };
  return { draft, setDraft: changeDraft, photo, photoUrl, photoBusy, extracting, photoError, choosePhoto, readPhoto, removePhoto, reset };
}
