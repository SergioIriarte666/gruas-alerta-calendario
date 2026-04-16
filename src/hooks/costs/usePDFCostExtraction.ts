import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { loadPdfJsCompat } from '@/utils/loadPdfJsCompat';

export interface ExtractedInvoiceItem {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
}

export interface ExtractedInvoiceData {
  vendorName: string;
  vendorRut: string;
  documentType: string;
  documentNumber: string;
  date: string | null;
  currency: string;
  totals: { neto?: number; iva?: number; total: number };
  paymentMethod: string;
  notes: string;
  items: ExtractedInvoiceItem[];
  confidence: Record<string, number>;
}

const RENDER_SCALE = 2;
const JPEG_QUALITY = 0.85;

/**
 * Convert the first page of a PDF File to a JPEG base64 string (without data: prefix).
 */
const pdfFirstPageToBase64Jpeg = async (file: File): Promise<{ base64: string; mimeType: string }> => {
  const pdfjs = await loadPdfJsCompat();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo crear contexto 2D para renderizar el PDF');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    const base64 = dataUrl.split(',')[1] || '';
    return { base64, mimeType: 'image/jpeg' };
  } finally {
    try { await pdf.destroy(); } catch { /* noop */ }
  }
};

export const usePDFCostExtraction = () => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractFromPDF = useCallback(async (file: File): Promise<ExtractedInvoiceData> => {
    setIsExtracting(true);
    setError(null);
    try {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('El archivo debe ser un PDF');
      }

      const { base64, mimeType } = await pdfFirstPageToBase64Jpeg(file);

      const { data, error: fnError } = await supabase.functions.invoke('parse-receipt-image', {
        body: {
          imageBase64: base64,
          imageMimeType: mimeType,
          mode: 'invoice',
        },
      });

      if (fnError) {
        const message = (fnError as any)?.message || 'Error al extraer datos del PDF';
        throw new Error(message);
      }

      if (!data || typeof data !== 'object') {
        throw new Error('La IA no devolvió datos');
      }

      if ((data as any).error) {
        throw new Error((data as any).error);
      }

      return data as ExtractedInvoiceData;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error desconocido al extraer datos del PDF';
      setError(message);
      throw e;
    } finally {
      setIsExtracting(false);
    }
  }, []);

  return { extractFromPDF, isExtracting, error };
};
