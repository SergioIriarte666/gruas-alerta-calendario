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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Save, AlertTriangle, Shield } from 'lucide-react';
import { APP_MODULES } from '@/constants/modules';
import { useUserModulePermissions } from '@/hooks/useUserModulePermissions';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";


const logger = createLogger("UserPermissionsModal");
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
      fetchPermissions(user.id, user.role);
    }
  }, [open, user?.id, user?.role, fetchPermissions]);

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
      const isPortalExemptRole = user.role === 'admin' || user.role === 'viewer';
      const permissionsToUpdate = Object.entries(localPermissions).map(([moduleKey, isEnabled]) => ({
        moduleKey,
        isEnabled: moduleKey === 'operator_portal' && isPortalExemptRole ? true : isEnabled
      }));

      const success = await updatePermissions(user.id, permissionsToUpdate);
      
      if (success) {
        toast.success('Permisos actualizados correctamente');
        onOpenChange(false);
      } else {
        toast.error('Error al guardar los permisos');
      }
    } catch (error) {
      logger.error('Error saving permissions:', error);
      toast.error('Error al guardar los permisos');
    } finally {
      setSaving(false);
    }
  };

  const userName = user?.full_name || user?.email || 'Usuario';
  const isPortalOnlyRole = user?.role === 'operator' || user?.role === 'client';
  const isPortalExemptRole = user?.role === 'admin' || user?.role === 'viewer';
  const portalModules = APP_MODULES.filter(m => m.key === 'operator_portal');
  const adminModules = APP_MODULES.filter(m => m.key !== 'operator_portal');

  const renderModuleCard = (module: typeof APP_MODULES[number]) => {
    const ModuleIcon = module.icon;
    const isPortalExempt = module.key === 'operator_portal' && isPortalExemptRole;
    const isEnabled = isPortalExempt ? true : (localPermissions[module.key] ?? true);

    const card = (
      <div
        key={module.key}
        className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
          isEnabled
            ? 'border-primary/30 bg-primary/10'
            : 'border-border/50 bg-muted/30'
        } ${isPortalExempt ? 'opacity-60' : ''}`}
      >
        <Checkbox
          id={`perm-${module.key}`}
          checked={isEnabled}
          disabled={isPortalExempt}
          onCheckedChange={(checked) => handleToggle(module.key, checked === true)}
        />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ModuleIcon className={`size-4 flex-shrink-0 ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
          <Label
            htmlFor={`perm-${module.key}`}
            className={`text-sm truncate ${isPortalExempt ? 'cursor-default' : 'cursor-pointer'} ${
              isEnabled ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {module.label}
          </Label>
        </div>
      </div>
    );

    if (!isPortalExempt) return card;

    return (
      <TooltipProvider key={module.key} delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>{card}</TooltipTrigger>
          <TooltipContent>Los administradores siempre tienen acceso</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="configuration-dialog flex max-h-[80vh] flex-col overflow-clip border-border/70 bg-card sm:max-w-[37.5rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            Permisos de Módulos - {userName}
          </DialogTitle>
          <DialogDescription>
            Selecciona los módulos que este usuario puede ver y acceder.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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

              {isPortalOnlyRole ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {portalModules.map(renderModuleCard)}
                  </div>
                  <p className="mt-4 mb-2 text-xs font-medium text-muted-foreground">
                    Módulos administrativos (no aplican al portal operador)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {adminModules.map(renderModuleCard)}
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {APP_MODULES.map(renderModuleCard)}
                </div>
              )}

              <Alert className="mt-4 border-warning/30 bg-warning/10">
                <AlertTriangle className="size-4 text-warning" />
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
          >
            {saving ? (
              <div className="mr-2 size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <Save className="size-4 mr-2" />
            )}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserPermissionsModal;
