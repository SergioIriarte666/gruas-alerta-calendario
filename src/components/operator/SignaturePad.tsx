
import React, { useRef, useImperativeHandle, forwardRef } from 'react';
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
          <h4 className="text-lg font-semibold text-white">{label}</h4>
          {personName && (
            <p className="text-sm text-gray-300 mt-1">
              Nombre: <span className="text-tms-green font-medium">{personName}</span>
            </p>
          )}
        </div>
        
        <div className="border-2 border-slate-600 rounded-lg bg-white relative">
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
              <Check className="w-5 h-5 text-green-500" />
            </div>
          )}
          
          <div className="absolute bottom-2 left-2 text-xs text-gray-400">
            Firme aquí con su dedo o stylus
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            type="button"
            onClick={handleClear}
            variant="outline"
            size="sm"
            className="border-slate-600 text-gray-300 hover:bg-slate-700"
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
