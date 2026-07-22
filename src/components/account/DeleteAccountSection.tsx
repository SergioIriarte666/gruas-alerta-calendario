import { useState } from 'react';
import { AlertTriangle, Database, Loader2, ShieldX, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { queryClient } from '@/lib/queryClient';
import { createLogger } from '@/lib/logger';
import { clearOperatorWidgets } from '@/native/operatorWidget';

const logger = createLogger('DeleteAccountSection');
const CONFIRMATION_TEXT = 'ELIMINAR';

export const DeleteAccountSection = () => {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (deleting) return;
    setOpen(nextOpen);
    if (!nextOpen) setConfirmation('');
  };

  const handleDeleteAccount = async () => {
    if (confirmation !== CONFIRMATION_TEXT || deleting) return;

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-my-account`, {
        method: 'POST',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmation: CONFIRMATION_TEXT }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.error || 'No se pudo completar la eliminación.');
      }

      queryClient.clear();
      await clearOperatorWidgets();
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace('/auth?account_deleted=true');
    } catch (error: unknown) {
      logger.error('No se pudo eliminar la cuenta', error);
      const message = error instanceof Error ? error.message : 'Inténtalo nuevamente.';
      setDeleting(false);
      setConfirmation('');
      setOpen(false);
      toast.error('No se pudo eliminar la cuenta', { description: message });
    }
  };

  return (
    <Card className="overflow-hidden border-destructive/25 bg-card/90 shadow-sm">
      <div className="h-1 bg-destructive/70" />
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <ShieldX className="size-5" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-foreground">Eliminar mi cuenta</CardTitle>
            <CardDescription>
              Borra definitivamente tus credenciales y los datos personales que no estén sujetos
              a una obligación de conservación.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/70 bg-muted/35 p-4 text-sm">
          <div className="flex gap-3">
            <Database className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="space-y-2 text-muted-foreground">
              <p>
                Se eliminarán tu acceso, perfil, avatar, preferencias, sesiones e historial personal.
              </p>
              <p>
                La ficha laboral, los servicios, inspecciones y documentos operativos que la empresa
                deba conservar permanecerán sin vínculo con tu cuenta ni con tus datos de acceso.
              </p>
            </div>
          </div>
        </div>

        <AlertDialog open={open} onOpenChange={handleOpenChange}>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" className="w-full sm:w-auto">
              <Trash2 className="mr-2 size-4" />
              Eliminar mi cuenta definitivamente
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="size-5" />
              </div>
              <AlertDialogTitle>Esta acción no se puede deshacer</AlertDialogTitle>
              <AlertDialogDescription className="text-left">
                Tu cuenta se eliminará inmediatamente y perderás el acceso en todos tus dispositivos.
                Para confirmar, escribe <strong className="text-foreground">ELIMINAR</strong>.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2 py-2">
              <Label htmlFor="delete-account-confirmation">Confirmación</Label>
              <Input
                id="delete-account-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value.toUpperCase())}
                placeholder={CONFIRMATION_TEXT}
                autoComplete="off"
                disabled={deleting}
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Conservar mi cuenta</AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                disabled={confirmation !== CONFIRMATION_TEXT || deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
                {deleting ? 'Eliminando cuenta…' : 'Eliminar definitivamente'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
