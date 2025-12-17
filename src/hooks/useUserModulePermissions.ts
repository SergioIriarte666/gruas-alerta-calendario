import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { APP_MODULES } from '@/constants/modules';
import { useAuth } from '@/contexts/AuthContext';

interface ModulePermission {
  module_key: string;
  is_enabled: boolean;
}

interface UserModulePermissionsResult {
  permissions: ModulePermission[];
  loading: boolean;
  error: string | null;
  fetchPermissions: (userId: string) => Promise<void>;
  updatePermission: (userId: string, moduleKey: string, isEnabled: boolean) => Promise<boolean>;
  updatePermissions: (userId: string, permissions: { moduleKey: string; isEnabled: boolean }[]) => Promise<boolean>;
  hasModuleAccess: (moduleKey: string) => boolean;
  currentUserPermissions: ModulePermission[];
  loadingCurrentUser: boolean;
}

export const useUserModulePermissions = (): UserModulePermissionsResult => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [currentUserPermissions, setCurrentUserPermissions] = useState<ModulePermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCurrentUser, setLoadingCurrentUser] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch permissions for a specific user (admin viewing other users)
  const fetchPermissions = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('user_module_permissions')
        .select('module_key, is_enabled')
        .eq('user_id', userId);

      if (fetchError) throw fetchError;

      // Map all modules with their permission status
      const allPermissions = APP_MODULES.map(module => {
        const existingPermission = data?.find(p => p.module_key === module.key);
        return {
          module_key: module.key,
          is_enabled: existingPermission ? existingPermission.is_enabled : true // Default to enabled
        };
      });

      setPermissions(allPermissions);
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar permisos');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch current user's permissions (for menu filtering)
  const fetchCurrentUserPermissions = useCallback(async () => {
    if (!user?.id) {
      setLoadingCurrentUser(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('user_module_permissions')
        .select('module_key, is_enabled')
        .eq('user_id', user.id);

      if (fetchError) throw fetchError;

      // Map all modules with their permission status
      const allPermissions = APP_MODULES.map(module => {
        const existingPermission = data?.find(p => p.module_key === module.key);
        return {
          module_key: module.key,
          is_enabled: existingPermission ? existingPermission.is_enabled : true // Default to enabled if no explicit permission
        };
      });

      setCurrentUserPermissions(allPermissions);
    } catch (err) {
      console.error('Error fetching current user permissions:', err);
      // On error, default to all enabled
      setCurrentUserPermissions(APP_MODULES.map(m => ({ module_key: m.key, is_enabled: true })));
    } finally {
      setLoadingCurrentUser(false);
    }
  }, [user?.id]);

  // Load current user permissions on mount
  useEffect(() => {
    fetchCurrentUserPermissions();
  }, [fetchCurrentUserPermissions]);

  // Update a single permission
  const updatePermission = async (userId: string, moduleKey: string, isEnabled: boolean): Promise<boolean> => {
    try {
      const { error: upsertError } = await supabase
        .from('user_module_permissions')
        .upsert({
          user_id: userId,
          module_key: moduleKey,
          is_enabled: isEnabled,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,module_key'
        });

      if (upsertError) throw upsertError;

      // Update local state
      setPermissions(prev => 
        prev.map(p => p.module_key === moduleKey ? { ...p, is_enabled: isEnabled } : p)
      );

      return true;
    } catch (err) {
      console.error('Error updating permission:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar permiso');
      return false;
    }
  };

  // Bulk update permissions
  const updatePermissions = async (userId: string, permissionsToUpdate: { moduleKey: string; isEnabled: boolean }[]): Promise<boolean> => {
    try {
      const upsertData = permissionsToUpdate.map(p => ({
        user_id: userId,
        module_key: p.moduleKey,
        is_enabled: p.isEnabled,
        updated_at: new Date().toISOString()
      }));

      const { error: upsertError } = await supabase
        .from('user_module_permissions')
        .upsert(upsertData, {
          onConflict: 'user_id,module_key'
        });

      if (upsertError) throw upsertError;

      // Update local state
      setPermissions(prev => 
        prev.map(p => {
          const update = permissionsToUpdate.find(u => u.moduleKey === p.module_key);
          return update ? { ...p, is_enabled: update.isEnabled } : p;
        })
      );

      return true;
    } catch (err) {
      console.error('Error updating permissions:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar permisos');
      return false;
    }
  };

  // Check if current user has access to a module
  const hasModuleAccess = useCallback((moduleKey: string): boolean => {
    const permission = currentUserPermissions.find(p => p.module_key === moduleKey);
    // Default to true if no explicit permission (backwards compatibility)
    return permission ? permission.is_enabled : true;
  }, [currentUserPermissions]);

  return {
    permissions,
    loading,
    error,
    fetchPermissions,
    updatePermission,
    updatePermissions,
    hasModuleAccess,
    currentUserPermissions,
    loadingCurrentUser
  };
};
