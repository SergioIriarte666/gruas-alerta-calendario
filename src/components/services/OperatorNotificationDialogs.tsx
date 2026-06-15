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
          className="max-w-md rounded-xl border-slate-300 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-950"
          overlayClassName="bg-slate-950/72 backdrop-blur-[2px]"
        >
          <AlertDialogHeader className="space-y-3 text-left">
            <AlertDialogTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Notificar operador
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
              ¿Desea notificar al operador asignado sobre este nuevo servicio a través de WhatsApp?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel
              onClick={onDecline}
              className="border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              No
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmSend}
              disabled={isSending}
              className="bg-violet-600 text-white hover:bg-violet-700 focus-visible:ring-violet-500"
            >
              {isSending ? 'Enviando...' : 'Sí'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={retryOpen} onOpenChange={(open) => !open && onRetryCancel()}>
        <AlertDialogContent
          className="max-w-md rounded-xl border-slate-300 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-950"
          overlayClassName="bg-slate-950/72 backdrop-blur-[2px]"
        >
          <AlertDialogHeader className="space-y-3 text-left">
            <AlertDialogTitle className="text-amber-700 dark:text-amber-300">Error de notificación</AlertDialogTitle>
            <AlertDialogDescription className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
              No se pudo enviar la notificación de WhatsApp. ¿Desea intentarlo nuevamente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel
              onClick={onRetryCancel}
              className="border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onRetry}
              disabled={isSending}
              className="bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500"
            >
              {isSending ? 'Enviando...' : 'Reintentar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
