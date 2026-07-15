import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { RotateCcw, Check } from 'lucide-react';
import { createLogger } from "@/lib/logger";

const logger = createLogger("SignaturePad");
interface SignaturePadProps {
  label: string;
  personName?: string;
  onSignatureChange: (signature: string) => void;
  signature?: string;
}
export interface SignaturePadRef {
  clear: () => void;
  isEmpty: () => boolean;
}
export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(({
  label,
  personName,
  onSignatureChange,
  signature
}, ref) => {
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  // Refleja el dataURL que el canvas YA está mostrando. Es la clave del fix:
  // handleEnd -> onSignatureChange -> cambia el prop `signature` -> dispara el
  // effect de restauración. Sin este guard, el effect hacía clear()+fromDataURL()
  // sobre el trazo recién dibujado por el usuario y, en un canvas estirado por CSS,
  // lo re-rasterizaba mal: el trazo desaparecía aunque el dato quedaba guardado.
  const lastSignatureRef = useRef<string>('');

  useImperativeHandle(ref, () => ({
    clear: () => {
      sigCanvasRef.current?.clear();
      lastSignatureRef.current = '';
      onSignatureChange('');
    },
    isEmpty: () => {
      return sigCanvasRef.current?.isEmpty() ?? true;
    }
  }));

  // El bitmap interno del canvas (por defecto 300x150) no coincide con el tamaño
  // que CSS le da (100% x 128px): sin igualarlos el trazo sale borroso/desalineado
  // y fromDataURL restaura en la escala equivocada. Se ajusta el bitmap al tamaño
  // mostrado (con devicePixelRatio) y se re-aplica la firma vigente, porque
  // redimensionar el canvas lo limpia.
  const resizeCanvas = useCallback(() => {
    const instance = sigCanvasRef.current;
    const canvas = instance?.getCanvas();
    if (!instance || !canvas) return;

    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    ctx?.scale(ratio, ratio);

    // Reasignar canvas.width/height deja el bitmap TRANSPARENTE (la prop
    // backgroundColor="white" del componente solo se aplica en clear()/montaje,
    // no tras un resize manual). Sin este relleno explícito, el tema oscuro se
    // ve a través del canvas y el trazo negro queda invisible al firmar. Se
    // fuerza fondo BLANCO, idéntico al PDF, antes de re-aplicar la firma.
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }

    if (lastSignatureRef.current) {
      try {
        instance.fromDataURL(lastSignatureRef.current, { width, height, ratio: 1 });
      } catch (error) {
        logger.error('❌ Error re-aplicando firma tras resize para', label, ':', error);
      }
    }
  }, [label]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', resizeCanvas);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('orientationchange', resizeCanvas);
    };
  }, [resizeCanvas]);

  // Restaura una firma provista EXTERNAMENTE (carga inicial, volver a la vista).
  // Ignora el cambio de prop provocado por nuestro propio handleEnd: ese trazo ya
  // está en el canvas y volver a dibujarlo lo borraría.
  useEffect(() => {
    const instance = sigCanvasRef.current;
    if (!instance) return;
    if ((signature ?? '') === lastSignatureRef.current) return;

    lastSignatureRef.current = signature ?? '';
    instance.clear();
    if (signature) {
      try {
        const canvas = instance.getCanvas();
        const { width, height } = canvas.getBoundingClientRect();
        if (width && height) {
          instance.fromDataURL(signature, { width, height, ratio: 1 });
        } else {
          instance.fromDataURL(signature);
        }
        logger.debug('✅ Signature restored for:', label);
      } catch (error) {
        logger.error('❌ Error restoring signature for', label, ':', error);
      }
    }
  }, [signature, label]);

  const handleClear = () => {
    sigCanvasRef.current?.clear();
    lastSignatureRef.current = '';
    onSignatureChange('');
  };
  const handleEnd = () => {
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      const signatureData = sigCanvasRef.current.toDataURL();
      // Marcar como ya reflejado en el canvas ANTES de propagar, para que el
      // effect de restauración lo ignore y no borre el trazo recién hecho.
      lastSignatureRef.current = signatureData;
      onSignatureChange(signatureData);
    }
  };
  return <div className="space-y-4">
        <div className="text-center">
          <h4 className="text-lg font-semibold text-foreground">{label}</h4>
          {personName && <p className="text-sm mt-1 text-muted-foreground">
              Nombre: <span className="text-violet-600 font-medium">{personName}</span>
            </p>}
        </div>

        <div className="border-2 border-border rounded-lg bg-white relative">
          <SignatureCanvas ref={sigCanvasRef} canvasProps={{
        className: 'signature-canvas w-full h-32',
        style: {
          width: '100%',
          height: '128px'
        }
      }} backgroundColor="white" penColor="black" onEnd={handleEnd} />

          {signature && <div className="absolute top-2 right-2">
              <Check className="size-5 text-emerald-500" />
            </div>}

          <div className="absolute bottom-2 left-2 text-xs text-gray-500">
            Firme aquí con su dedo o stylus
          </div>
        </div>

        <div className="flex justify-center">
          <Button type="button" onClick={handleClear} variant="outline" size="sm">
            <RotateCcw className="size-4 mr-2" />
            Limpiar Firma
          </Button>
        </div>
      </div>;
});
SignaturePad.displayName = 'SignaturePad';
