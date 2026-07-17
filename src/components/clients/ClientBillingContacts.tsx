import { useState } from 'react';
import { useClientBillingContacts } from '@/hooks/useClientBillingContacts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Plus, Pencil, Trash2, Mail, Phone, User, Briefcase } from 'lucide-react';

interface ClientBillingContactsProps {
  clientId: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ClientBillingContacts = ({ clientId }: ClientBillingContactsProps) => {
  const { contacts, isLoading, createContact, updateContact, toggleActive, deleteContact } = useClientBillingContacts(clientId);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPosition, setFormPosition] = useState('');
  const [formError, setFormError] = useState('');

  const openCreate = () => {
    setEditingId(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormPosition('');
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (contact: any) => {
    setEditingId(contact.id);
    setFormName(contact.name);
    setFormEmail(contact.email);
    setFormPhone(contact.phone || '');
    setFormPosition(contact.position || '');
    setFormError('');
    setFormOpen(true);
  };

  const validateForm = (): boolean => {
    if (!formName.trim()) {
      setFormError('El nombre es requerido.');
      return false;
    }
    if (!formEmail.trim()) {
      setFormError('El email es requerido.');
      return false;
    }
    if (!emailRegex.test(formEmail.trim())) {
      setFormError('El formato del email no es valido.');
      return false;
    }
    setFormError('');
    return true;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    const input = {
      name: formName.trim(),
      email: formEmail.trim(),
      phone: formPhone.trim() || undefined,
      position: formPosition.trim() || undefined,
    };

    if (editingId) {
      updateContact.mutate({ id: editingId, ...input });
    } else {
      createContact.mutate(input);
    }
    setFormOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteContact.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const contactToDelete = contacts.find(c => c.id === deleteId);
  const isSaving = createContact.isPending || updateContact.isPending;

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">Contactos de Cobranza</CardTitle>
          <Button onClick={openCreate} size="sm">
            <Plus className="size-4 mr-1" />
            Agregar contacto
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Cargando contactos...
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm space-y-2">
              <User className="size-8 mx-auto opacity-50" />
              <p>Sin contactos de cobranza.</p>
              <p className="text-xs">
                Los correos de facturas vencidas se enviaran al email principal del cliente.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className={`flex items-center gap-3 rounded-lg border border-border p-3 ${
                    !contact.is_active ? 'opacity-50' : ''
                  }`}
                >
                  <Switch
                    checked={contact.is_active}
                    onCheckedChange={(checked) =>
                      toggleActive.mutate({ id: contact.id, is_active: checked })
                    }
                  />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground text-sm truncate">
                        {contact.name}
                      </span>
                      {!contact.is_active && (
                        <Badge variant="outline" className="text-xs">Inactivo</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" />
                        {contact.email}
                      </span>
                      {contact.position && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="size-3" />
                          {contact.position}
                        </span>
                      )}
                      {contact.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="size-3" />
                          {contact.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => openEdit(contact)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(contact.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="operations-dialog max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar contacto' : 'Agregar contacto'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bc-name">Nombre *</Label>
              <Input
                id="bc-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nombre del contacto"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bc-email">Email *</Label>
              <Input
                id="bc-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bc-phone">Telefono</Label>
              <Input
                id="bc-phone"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="+56 9 XXXX XXXX"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bc-position">Cargo</Label>
              <Input
                id="bc-position"
                value={formPosition}
                onChange={(e) => setFormPosition(e.target.value)}
                placeholder="Ej: Encargado de cuentas"
              />
            </div>
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar contacto</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminara el contacto <strong>{contactToDelete?.name}</strong>.
              Esta accion no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteContact.isPending}
            >
              {deleteContact.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
