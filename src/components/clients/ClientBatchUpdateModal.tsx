import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ClientBatchUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (updates: { department?: string; isActive?: boolean }) => void;
  selectedCount: number;
  departments: string[];
  isProcessing?: boolean;
}

export const ClientBatchUpdateModal = ({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  departments,
  isProcessing = false,
}: ClientBatchUpdateModalProps) => {
  const [enableDepartment, setEnableDepartment] = useState(false);
  const [enableStatus, setEnableStatus] = useState(false);
  const [department, setDepartment] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [isActive, setIsActive] = useState(true);

  const handleConfirm = () => {
    const updates: { department?: string; isActive?: boolean } = {};
    if (enableDepartment) {
      updates.department = department === '__new__' ? newDepartment.trim() : department;
    }
    if (enableStatus) {
      updates.isActive = isActive;
    }
    if (Object.keys(updates).length === 0) return;
    onConfirm(updates);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setEnableDepartment(false);
      setEnableStatus(false);
      setDepartment('');
      setNewDepartment('');
      setIsActive(true);
      onClose();
    }
  };

  const canConfirm = (enableDepartment && (department === '__new__' ? newDepartment.trim() : department)) || enableStatus;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar {selectedCount} cliente{selectedCount !== 1 ? 's' : ''}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Department */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Departamento</Label>
              <Switch checked={enableDepartment} onCheckedChange={setEnableDepartment} />
            </div>
            {enableDepartment && (
              <div className="space-y-2">
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                    <SelectItem value="__new__">+ Nuevo departamento</SelectItem>
                  </SelectContent>
                </Select>
                {department === '__new__' && (
                  <Input
                    placeholder="Nombre del nuevo departamento"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                  />
                )}
              </div>
            )}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Estado</Label>
              <Switch checked={enableStatus} onCheckedChange={setEnableStatus} />
            </div>
            {enableStatus && (
              <Select value={isActive ? 'active' : 'inactive'} onValueChange={(v) => setIsActive(v === 'active')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || isProcessing}>
            {isProcessing ? 'Aplicando...' : 'Aplicar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
