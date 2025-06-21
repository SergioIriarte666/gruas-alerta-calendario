
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
        return 'bg-red-500 hover:bg-red-600 text-white';
      case 'operator':
        return 'bg-blue-500 hover:bg-blue-600 text-white';
      case 'viewer':
        return 'bg-green-500 hover:bg-green-600 text-white';
      default:
        return 'bg-gray-500 hover:bg-gray-600 text-white';
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
        <Loader2 className="w-6 h-6 animate-spin text-black" />
        <span className="ml-2 text-black">Cargando usuarios...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white border-gray-300">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-black">Gestión de Usuarios</CardTitle>
              <CardDescription className="text-gray-600">
                Administra los usuarios y sus roles en el sistema
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={refetchUsers}
                variant="outline"
                size="sm"
                className="border-gray-300 text-black hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-gray-300">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-300 hover:bg-gray-50">
                  <TableHead className="text-black font-medium">Usuario</TableHead>
                  <TableHead className="text-black font-medium">Rol</TableHead>
                  <TableHead className="text-black font-medium">Estado</TableHead>
                  <TableHead className="text-black font-medium">Fecha Registro</TableHead>
                  <TableHead className="text-black font-medium">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="border-gray-300 hover:bg-gray-50">
                    <TableCell>
                      <div>
                        <div className="font-medium text-black">
                          {user.full_name || 'Sin nombre'}
                        </div>
                        <div className="text-sm text-gray-600">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(user.role)}>
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
                        <span className={`text-sm ${user.is_active ? 'text-green-600' : 'text-red-600'}`}>
                          {user.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-black">
                      {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(newRole) => updateUserRole(user.id, newRole as any)}
                        disabled={updating === user.id}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">
                            Administrador
                          </SelectItem>
                          <SelectItem value="operator">
                            Operador
                          </SelectItem>
                          <SelectItem value="viewer">
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
            <div className="text-center py-8 text-gray-600">
              No se encontraron usuarios en el sistema.
            </div>
          )}

          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-300">
            <h4 className="text-black font-medium mb-2">Información sobre Usuarios de Prueba</h4>
            <p className="text-gray-600 text-sm mb-3">
              Para probar los diferentes roles, los usuarios deben registrarse normalmente en la aplicación. 
              Luego podrás cambiar sus roles desde esta interfaz.
            </p>
            <div className="space-y-2 text-sm">
              <div className="text-black">
                <strong>Roles disponibles:</strong>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="p-2 bg-red-50 rounded border border-red-200">
                  <strong className="text-red-700">Administrador:</strong>
                  <p className="text-gray-600 text-xs">Acceso completo al sistema</p>
                </div>
                <div className="p-2 bg-blue-50 rounded border border-blue-200">
                  <strong className="text-blue-700">Operador:</strong>
                  <p className="text-gray-600 text-xs">Acceso a funciones operativas</p>
                </div>
                <div className="p-2 bg-green-50 rounded border border-green-200">
                  <strong className="text-green-700">Visualizador:</strong>
                  <p className="text-gray-600 text-xs">Solo lectura del sistema</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
