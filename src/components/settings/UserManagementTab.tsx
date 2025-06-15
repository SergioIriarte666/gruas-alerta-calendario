
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, UserPlus, RefreshCw } from 'lucide-react';
import { useUserManagement } from '@/hooks/useUserManagement';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const UserManagementTab = () => {
  const { users, loading, updating, updateUserRole, toggleUserStatus, refetchUsers } = useUserManagement();

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500 hover:bg-red-600';
      case 'operator':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'viewer':
        return 'bg-green-500 hover:bg-green-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'operator':
        return 'Operador';
      case 'viewer':
        return 'Visualizador';
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-white" />
        <span className="ml-2 text-white">Cargando usuarios...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-black/40 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Gestión de Usuarios</CardTitle>
              <CardDescription className="text-gray-400">
                Administra los usuarios y sus roles en el sistema
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={refetchUsers}
                variant="outline"
                size="sm"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-gray-700">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700 hover:bg-gray-800/50">
                  <TableHead className="text-gray-300">Usuario</TableHead>
                  <TableHead className="text-gray-300">Rol</TableHead>
                  <TableHead className="text-gray-300">Estado</TableHead>
                  <TableHead className="text-gray-300">Fecha Registro</TableHead>
                  <TableHead className="text-gray-300">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="border-gray-700 hover:bg-gray-800/50">
                    <TableCell>
                      <div>
                        <div className="font-medium text-white">
                          {user.full_name || 'Sin nombre'}
                        </div>
                        <div className="text-sm text-gray-400">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getRoleBadgeColor(user.role)} text-white`}>
                        {getRoleLabel(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={user.is_active}
                          onCheckedChange={(checked) => toggleUserStatus(user.id, checked)}
                          disabled={updating === user.id}
                        />
                        <span className={`text-sm ${user.is_active ? 'text-green-400' : 'text-red-400'}`}>
                          {user.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(newRole) => updateUserRole(user.id, newRole as any)}
                        disabled={updating === user.id}
                      >
                        <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="admin" className="text-white hover:bg-gray-700">
                            Administrador
                          </SelectItem>
                          <SelectItem value="operator" className="text-white hover:bg-gray-700">
                            Operador
                          </SelectItem>
                          <SelectItem value="viewer" className="text-white hover:bg-gray-700">
                            Visualizador
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No se encontraron usuarios en el sistema.
            </div>
          )}

          <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <h4 className="text-white font-medium mb-2">Información sobre Usuarios de Prueba</h4>
            <p className="text-gray-400 text-sm mb-3">
              Para probar los diferentes roles, los usuarios deben registrarse normalmente en la aplicación. 
              Luego podrás cambiar sus roles desde esta interfaz.
            </p>
            <div className="space-y-2 text-sm">
              <div className="text-gray-300">
                <strong>Roles disponibles:</strong>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="p-2 bg-red-500/20 rounded border border-red-500/30">
                  <strong className="text-red-400">Administrador:</strong>
                  <p className="text-gray-400 text-xs">Acceso completo al sistema</p>
                </div>
                <div className="p-2 bg-blue-500/20 rounded border border-blue-500/30">
                  <strong className="text-blue-400">Operador:</strong>
                  <p className="text-gray-400 text-xs">Acceso a funciones operativas</p>
                </div>
                <div className="p-2 bg-green-500/20 rounded border border-green-500/30">
                  <strong className="text-green-400">Visualizador:</strong>
                  <p className="text-gray-400 text-xs">Solo lectura del sistema</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
