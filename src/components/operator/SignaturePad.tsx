
import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { RotateCcw, Check } from 'lucide-react';

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

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ label, personName, onSignatureChange, signature }, ref) => {
    const sigCanvasRef = useRef<SignatureCanvas>(null);

    useImperativeHandle(ref, () => ({
      clear: () => {
        sigCanvasRef.current?.clear();
        onSignatureChange('');
      },
      isEmpty: () => {
        return sigCanvasRef.current?.isEmpty() ?? true;
      }
    }));

    // Restaurar firma cuando cambie el prop signature
    useEffect(() => {
      if (signature && sigCanvasRef.current) {
        try {
          // Limpiar el canvas antes de restaurar
          sigCanvasRef.current.clear();
          // Restaurar la firma
          sigCanvasRef.current.fromDataURL(signature);
          console.log('✅ Signature restored for:', label);
        } catch (error) {
          console.error('❌ Error restoring signature for', label, ':', error);
        }
      } else if (!signature && sigCanvasRef.current) {
        // Si no hay firma, limpiar el canvas
        sigCanvasRef.current.clear();
      }
    }, [signature, label]);

    const handleClear = () => {
      sigCanvasRef.current?.clear();
      onSignatureChange('');
    };

    const handleEnd = () => {
      if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
        const signatureData = sigCanvasRef.current.toDataURL();
        onSignatureChange(signatureData);
      }
    };

    return (
      <div className="space-y-4">
        <div className="text-center">
          <h4 className="text-lg font-semibold text-foreground">{label}</h4>
          {personName && (
            <p className="text-sm text-muted-foreground mt-1">
              Nombre: <span className="text-primary font-medium">{personName}</span>
            </p>
          )}
        </div>
        
        <div className="border-2 border-border rounded-lg bg-background relative">
          <SignatureCanvas
            ref={sigCanvasRef}
            canvasProps={{
              className: 'signature-canvas w-full h-32',
              style: { width: '100%', height: '128px' }
            }}
            backgroundColor="white"
            penColor="black"
            onEnd={handleEnd}
          />
          
          {signature && (
            <div className="absolute top-2 right-2">
              <Check className="w-5 h-5 text-emerald-500" />
            </div>
          )}
          
          <div className="absolute bottom-2 left-2 text-xs text-muted-foreground">
            Firme aquí con su dedo o stylus
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            type="button"
            onClick={handleClear}
            variant="outline"
            size="sm"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Limpiar Firma
          </Button>
        </div>
      </div>
    );
  }
);

SignaturePad.displayName = 'SignaturePad';
