import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, AlertTriangle, Shield } from 'lucide-react';
import { APP_MODULES } from '@/constants/modules';
import { useUserModulePermissions } from '@/hooks/useUserModulePermissions';
import { toast } from 'sonner';

interface User {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

interface UserPermissionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

const UserPermissionsModal: React.FC<UserPermissionsModalProps> = ({
  open,
  onOpenChange,
  user,
}) => {
  const { permissions, loading, fetchPermissions, updatePermissions } = useUserModulePermissions();
  const [localPermissions, setLocalPermissions] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && user?.id) {
      fetchPermissions(user.id);
    }
  }, [open, user?.id, fetchPermissions]);

  useEffect(() => {
    // Initialize local state from fetched permissions
    const permMap: Record<string, boolean> = {};
    permissions.forEach(p => {
      permMap[p.module_key] = p.is_enabled;
    });
    setLocalPermissions(permMap);
  }, [permissions]);

  const handleToggle = (moduleKey: string, checked: boolean) => {
    setLocalPermissions(prev => ({
      ...prev,
      [moduleKey]: checked
    }));
  };

  const handleSelectAll = () => {
    const allEnabled: Record<string, boolean> = {};
    APP_MODULES.forEach(m => {
      allEnabled[m.key] = true;
    });
    setLocalPermissions(allEnabled);
  };

  const handleDeselectAll = () => {
    const allDisabled: Record<string, boolean> = {};
    APP_MODULES.forEach(m => {
      allDisabled[m.key] = false;
    });
    setLocalPermissions(allDisabled);
  };

  const handleSave = async () => {
    if (!user?.id) return;

    setSaving(true);
    try {
      const permissionsToUpdate = Object.entries(localPermissions).map(([moduleKey, isEnabled]) => ({
        moduleKey,
        isEnabled
      }));

      const success = await updatePermissions(user.id, permissionsToUpdate);
      
      if (success) {
        toast.success('Permisos actualizados correctamente');
        onOpenChange(false);
      } else {
        toast.error('Error al guardar los permisos');
      }
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Error al guardar los permisos');
    } finally {
      setSaving(false);
    }
  };

  const userName = user?.full_name || user?.email || 'Usuario';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-violet-500" />
            Permisos de Módulos - {userName}
          </DialogTitle>
          <DialogDescription>
            Selecciona los módulos que este usuario puede ver y acceder.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSelectAll}
                  className="text-xs"
                >
                  Seleccionar todos
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDeselectAll}
                  className="text-xs"
                >
                  Deseleccionar todos
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {APP_MODULES.map(module => {
                  const ModuleIcon = module.icon;
                  const isEnabled = localPermissions[module.key] ?? true;

                  return (
                    <div
                      key={module.key}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isEnabled 
                          ? 'bg-violet-500/10 border-violet-500/30' 
                          : 'bg-muted/30 border-border/50'
                      }`}
                    >
                      <Checkbox
                        id={`perm-${module.key}`}
                        checked={isEnabled}
                        onCheckedChange={(checked) => handleToggle(module.key, checked === true)}
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <ModuleIcon className={`w-4 h-4 flex-shrink-0 ${isEnabled ? 'text-violet-500' : 'text-muted-foreground'}`} />
                        <Label 
                          htmlFor={`perm-${module.key}`}
                          className={`text-sm cursor-pointer truncate ${
                            isEnabled ? 'text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {module.label}
                        </Label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Alert className="mt-4 border-amber-500/30 bg-amber-500/10">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <AlertDescription className="text-xs text-muted-foreground">
                  Los módulos deshabilitados no aparecerán en el menú lateral ni serán accesibles por URL para este usuario.
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || loading}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserPermissionsModal;
