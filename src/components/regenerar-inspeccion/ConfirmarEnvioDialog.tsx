import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RegenerarInspeccionKind } from '@/types/regenerar-inspeccion';

interface ConfirmarEnvioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folio: string;
  kind: RegenerarInspeccionKind;
  enviarWhatsapp: boolean;
  isPending: boolean;
  hasExistingPdf: boolean;
  motivo: string;
  onConfirm: () => void;
}

export const ConfirmarEnvioDialog = ({
  open,
  onOpenChange,
  folio,
  kind,
  enviarWhatsapp,
  isPending,
  hasExistingPdf,
  motivo,
  onConfirm,
}: ConfirmarEnvioDialogProps) => {
  const motivoMissing = hasExistingPdf && !motivo.trim();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar regeneración</AlertDialogTitle>
          <AlertDialogDescription>
            Se generará un nuevo PDF de {kind === 'initial' ? 'inspección inicial' : 'entrega'} para el folio {folio}.
            {hasExistingPdf ? ' El PDF anterior quedará intacto en Storage para trazabilidad.' : ''}
            {enviarWhatsapp ? ' Al finalizar se enviará por WhatsApp al destinatario prioritario del servicio.' : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {motivoMissing && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            El motivo es obligatorio porque se sobrescribirá la referencia de un PDF existente.
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={isPending || motivoMissing} onClick={onConfirm}>
            {isPending ? 'Regenerando...' : 'Regenerar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
