import { useState } from 'react';
import { PaymentTerm } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePaymentTerms } from '@/hooks/usePaymentTerms';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil } from 'lucide-react';
import { PaymentTermFormModal } from './PaymentTermFormModal';

export const PaymentTermsSettings = () => {
  const isMobile = useIsMobile();
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-semibold text-foreground">Condiciones de Pago</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Administra las condiciones de pago disponibles para las facturas
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2" size={isMobile ? "sm" : "default"}>
          <Plus className="size-4" />
          {isMobile ? "Agregar" : "Agregar Condición"}
        </Button>
      </div>

      <div className="grid gap-4">
        {paymentTerms.map((term) => (
          <Card key={term.id} className="p-3 sm:p-4 border border-border bg-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-foreground text-sm sm:text-base">{term.name}</h3>
                  <Badge
                    variant={term.is_active ? 'default' : 'secondary'}
                    className={
                      term.is_active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 text-xs'
                    }
                  >
                    {term.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <div className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  <span className="font-medium">Código:</span> {term.code}
                  {term.days > 0 && (
                    <>
                      {' • '}
                      <span className="font-medium">Días:</span> {term.days}
                    </>
                  )}
                </div>
                {term.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{term.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={term.is_active}
                    onCheckedChange={() => handleToggleActive(term)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(term)}
                  className="gap-1"
                >
                  <Pencil className="size-3" />
                  {!isMobile && "Editar"}
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
            <Plus className="size-4" />
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
