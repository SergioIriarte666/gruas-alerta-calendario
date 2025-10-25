import { useState } from 'react';
import { PaymentTerm } from '@/types';
import { usePaymentTerms } from '@/hooks/usePaymentTerms';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil } from 'lucide-react';
import { PaymentTermFormModal } from './PaymentTermFormModal';

export const PaymentTermsSettings = () => {
  const { paymentTerms, loading, updatePaymentTerm } = usePaymentTerms();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<PaymentTerm | null>(null);

  const handleEdit = (term: PaymentTerm) => {
    setEditingTerm(term);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingTerm(null);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (term: PaymentTerm) => {
    await updatePaymentTerm(term.id, { is_active: !term.is_active });
  };

  if (loading) {
    return <div className="text-center py-8">Cargando condiciones de pago...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Condiciones de Pago</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Administra las condiciones de pago disponibles para las facturas
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Agregar Condición
        </Button>
      </div>

      <div className="grid gap-4">
        {paymentTerms.map((term) => (
          <Card key={term.id} className="p-4 border border-border bg-card">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-foreground">{term.name}</h3>
                  <Badge
                    variant={term.is_active ? 'default' : 'secondary'}
                    className={
                      term.is_active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                    }
                  >
                    {term.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  <span className="font-medium">Código:</span> {term.code}
                  {term.days > 0 && (
                    <>
                      {' • '}
                      <span className="font-medium">Días:</span> {term.days}
                    </>
                  )}
                </div>
                {term.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{term.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {term.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  <Switch
                    checked={term.is_active}
                    onCheckedChange={() => handleToggleActive(term)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(term)}
                  className="gap-2"
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {paymentTerms.length === 0 && (
        <Card className="p-8 text-center border border-border bg-card">
          <p className="text-muted-foreground">No hay condiciones de pago configuradas</p>
          <Button onClick={handleCreate} className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Crear Primera Condición
          </Button>
        </Card>
      )}

      <PaymentTermFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTerm(null);
        }}
        editingTerm={editingTerm}
      />
    </div>
  );
};
