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

interface OperatorNotificationDialogsProps {
  confirmOpen: boolean;
  retryOpen: boolean;
  isSending: boolean;
  onConfirmSend: () => void;
  onDecline: () => void;
  onRetry: () => void;
  onRetryCancel: () => void;
}

export const OperatorNotificationDialogs = ({
  confirmOpen,
  retryOpen,
  isSending,
  onConfirmSend,
  onDecline,
  onRetry,
  onRetryCancel,
}: OperatorNotificationDialogsProps) => {
  return (
    <>
      <AlertDialog open={confirmOpen} onOpenChange={(open) => !open && onDecline()}>
        <AlertDialogContent
          className="max-w-md rounded-xl border-border bg-card p-5 shadow-2xl"
          overlayClassName="bg-overlay/75 backdrop-blur-sm"
        >
          <AlertDialogHeader className="space-y-3 text-left">
            <AlertDialogTitle className="text-xl font-semibold text-foreground">
              Notificar operador
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base leading-relaxed text-muted-foreground">
              ¿Desea notificar al operador asignado sobre este nuevo servicio a través de WhatsApp?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel
              onClick={onDecline}
              className="border-border bg-muted text-foreground hover:bg-muted/80"
            >
              No
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmSend}
              disabled={isSending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary"
            >
              {isSending ? 'Enviando...' : 'Sí'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={retryOpen} onOpenChange={(open) => !open && onRetryCancel()}>
        <AlertDialogContent
          className="max-w-md rounded-xl border-border bg-card p-5 shadow-2xl"
          overlayClassName="bg-overlay/75 backdrop-blur-sm"
        >
          <AlertDialogHeader className="space-y-3 text-left">
            <AlertDialogTitle className="text-warning-text">Error de notificación</AlertDialogTitle>
            <AlertDialogDescription className="text-base leading-relaxed text-muted-foreground">
              No se pudo enviar la notificación de WhatsApp. ¿Desea intentarlo nuevamente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel
              onClick={onRetryCancel}
              className="border-border bg-muted text-foreground hover:bg-muted/80"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onRetry}
              disabled={isSending}
              className="bg-warning text-warning-foreground hover:bg-warning/90 focus-visible:ring-warning"
            >
              {isSending ? 'Enviando...' : 'Reintentar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
