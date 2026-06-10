import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, UserPlus, RefreshCw, Settings, Trash2, Shield, HardHat } from 'lucide-react';
import { useUserManagement } from '@/hooks/useUserManagement';
import { CreateUserDialog } from './CreateUserDialog';
import UserPermissionsModal from './UserPermissionsModal';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import { toTitleCase } from '@/lib/utils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useUser } from '@/contexts/UserContext';

const roleBadgeClassNames: Record<string, string> = {
  admin: 'border-danger/20 bg-danger/10 text-danger',
  operator: 'border-info/20 bg-info/10 text-info',
  viewer: 'border-success/20 bg-success/10 text-success',
  client: 'border-primary/20 bg-primary/10 text-primary',
};

const invitationBadgeClassNames: Record<string, string> = {
  pending: 'border-warning/20 bg-warning/10 text-warning',
  sent: 'border-info/20 bg-info/10 text-info',
  accepted: 'border-success/20 bg-success/10 text-success',
  expired: 'border-danger/20 bg-danger/10 text-danger',
};

const formatClientOption = (client: { name: string; rut: string; department?: string | null }) => {
  const branchLabel = client.department?.trim();
  return {
    title: toTitleCase(client.name),
    subtitle: branchLabel ? `Sucursal: ${toTitleCase(branchLabel)} · ${client.rut}` : client.rut,
  };
};

export const UserManagementTab = () => {
  const isMobile = useIsMobile();
  const { isAdmin } = useUserPermissions();
  const { user: currentUser } = useUser();
  const { 
    users, 
    clients, 
    operators,
    loading, 
    updating, 
    creating, 
    sendingInvitation,
    createUser, 
    updateUserRole, 
    assignClientToUser, 
    assignOperatorToUser,
    toggleUserStatus, 
    deleteUser,
    refetchUsers,
    resendInvitation,
    getInvitationStatus
  } = useUserManagement();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isClientAssignOpen, setIsClientAssignOpen] = useState(false);
  const [isOperatorAssignOpen, setIsOperatorAssignOpen] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [userForPermissions, setUserForPermissions] = useState<any>(null);

  const getRoleBadgeColor = (role: string) => {
    return roleBadgeClassNames[role] || 'border-border/70 bg-muted text-muted-foreground';
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'operator': return 'Operador';
      case 'viewer': return 'Visualizador';
      case 'client': return 'Cliente';
      default: return role;
    }
  };

  const getInvitationStatusBadge = (user: any) => {
    const invitation = getInvitationStatus(user.id);
    if (!invitation) return <Badge variant="outline" className="text-xs">Sin invitación</Badge>;
    switch (invitation.status) {
      case 'pending': return <Badge variant="outline" className={`text-xs ${invitationBadgeClassNames.pending}`}>Pendiente</Badge>;
      case 'sent': return <Badge variant="outline" className={`text-xs ${invitationBadgeClassNames.sent}`}>Enviada</Badge>;
      case 'accepted': return <Badge variant="outline" className={`text-xs ${invitationBadgeClassNames.accepted}`}>Registrado</Badge>;
      case 'expired': return <Badge variant="outline" className={`text-xs ${invitationBadgeClassNames.expired}`}>Expirada</Badge>;
      default: return <Badge variant="outline" className="text-xs">Desconocido</Badge>;
    }
  };

  const handleAssignClient = async (clientId: string | null) => {
    if (selectedUser) {
      const result = await assignClientToUser(selectedUser.id, clientId);
      if (result?.success) {
        setIsClientAssignOpen(false);
        setSelectedUser(null);
      }
    }
  };

  const handleAssignOperator = async (operatorId: string | null) => {
    if (selectedUser) {
      const result = await assignOperatorToUser(selectedUser.id, operatorId);
      if (result?.success) {
        setIsOperatorAssignOpen(false);
        setSelectedUser(null);
      }
    }
  };

  const handleUserCreated = () => { refetchUsers(); };

  const handleDeleteUser = async () => {
    if (userToDelete) {
      await deleteUser(userToDelete.id);
      setUserToDelete(null);
    }
  };

  if (loading) {
    return (
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardContent className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="size-6 animate-spin text-foreground" />
          <span className="text-foreground">Cargando usuarios...</span>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Gestión de Usuarios</CardTitle>
          <CardDescription className="text-muted-foreground">
            Esta sección solo está disponible para administradores.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-foreground text-lg sm:text-xl">Gestión de Usuarios</CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                Administra los usuarios y sus roles en el sistema
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setIsCreateUserOpen(true)}
                size={isMobile ? "sm" : "default"}
                disabled={creating}
              >
                {creating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="size-4 mr-1" />
                    {isMobile ? "Nuevo" : "Nuevo Usuario"}
                  </>
                )}
              </Button>
              <Button
                onClick={refetchUsers}
                variant="outline"
                size="sm"
                className="border-border/70 bg-background/60"
              >
                <RefreshCw className="size-4" />
                {!isMobile && <span className="ml-1">Actualizar</span>}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          {isMobile ? (
            /* ===== Mobile Card View ===== */
            <div className="space-y-3">
              {users.map((user) => (
                <Card key={user.id} className="border-border/70 bg-background/50 shadow-none">
                  <CardContent className="space-y-3 p-4">
                    {/* User Info + Role Badge */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">
                          {user.full_name || 'Sin nombre'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <Badge variant="outline" className={getRoleBadgeColor(user.role) + ' text-xs flex-shrink-0 ml-2'}>
                        {getRoleLabel(user.role)}
                      </Badge>
                    </div>

                    {/* Status + Invitation */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={user.is_active}
                          onCheckedChange={(checked) => toggleUserStatus(user.id, checked)}
                          disabled={updating === user.id}
                        />
                        <span className={`text-xs ${user.is_active ? 'text-success' : 'text-danger'}`}>
                          {user.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      {getInvitationStatusBadge(user)}
                    </div>

                    {/* Client + Date */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {user.role === 'client'
                          ? toTitleCase(user.client_name || 'Sin asignar')
                          : user.operator_name
                            ? `Operador: ${toTitleCase(user.operator_name)}`
                            : 'Operador: Sin asignar'}
                      </span>
                      <span>{format(new Date(user.created_at), 'dd/MM/yyyy', { locale: es })}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 border-t border-border/70 pt-2">
                      <Select
                        value={user.role}
                        onValueChange={(newRole) => updateUserRole(user.id, newRole as any)}
                        disabled={updating === user.id}
                      >
                        <SelectTrigger className="flex-1 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="operator">Operador</SelectItem>
                          <SelectItem value="viewer">Visualizador</SelectItem>
                          <SelectItem value="client">Cliente</SelectItem>
                        </SelectContent>
                      </Select>
                      {user.role === 'client' && (
                        <Dialog open={isClientAssignOpen && selectedUser?.id === user.id} onOpenChange={(open) => {
                          setIsClientAssignOpen(open);
                          if (!open) setSelectedUser(null);
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => setSelectedUser(user)}>
                              <Settings className="size-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="flex max-h-[85vh] w-[90vw] max-w-md flex-col overflow-hidden border-border/70 bg-card p-0">
                            <DialogHeader className="border-b border-border/70 px-6 py-4">
                              <DialogTitle className="text-foreground">Asignar Cliente</DialogTitle>
                            </DialogHeader>
                            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-6 py-4">
                              <Button variant="outline" className="w-full justify-start text-sm whitespace-normal h-auto py-3" onClick={() => handleAssignClient(null)}>
                                Sin cliente asignado
                              </Button>
                              {clients.map((client) => (
                                <Button key={client.id} variant="outline" className="w-full justify-start text-sm whitespace-normal h-auto py-3 text-left" onClick={() => handleAssignClient(client.id)}>
                                  <div className="flex flex-col items-start">
                                    <span>{formatClientOption(client).title}</span>
                                    <span className="text-xs text-muted-foreground">{formatClientOption(client).subtitle}</span>
                                  </div>
                                </Button>
                              ))}
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      {user.role !== 'client' && (
                        <Dialog open={isOperatorAssignOpen && selectedUser?.id === user.id} onOpenChange={(open) => {
                          setIsOperatorAssignOpen(open);
                          if (!open) setSelectedUser(null);
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => setSelectedUser(user)}>
                              <HardHat className="size-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="flex max-h-[85vh] w-[90vw] max-w-md flex-col overflow-hidden border-border/70 bg-card p-0">
                            <DialogHeader className="border-b border-border/70 px-6 py-4">
                              <DialogTitle className="text-foreground">Asignar Operador</DialogTitle>
                            </DialogHeader>
                            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
                              <div className="text-xs text-muted-foreground">
                                Operador actual: <span className="text-foreground">{user.operator_name ? toTitleCase(user.operator_name) : 'Sin asignar'}</span>
                              </div>
                              <div className="space-y-2">
                                <Button variant="outline" className="w-full justify-start text-sm whitespace-normal h-auto py-3" onClick={() => handleAssignOperator(null)}>
                                  Sin operador asignado
                                </Button>
                                {operators.map((op) => (
                                  <Button key={op.id} variant="outline" className="w-full justify-start text-sm whitespace-normal h-auto py-3 text-left" onClick={() => handleAssignOperator(op.id)}>
                                    {toTitleCase(op.name)} ({op.rut})
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      <Button variant="ghost" size="icon" className="size-8 text-primary hover:bg-primary/10 hover:text-primary" onClick={() => setUserForPermissions(user)}>
                        <Shield className="size-4" />
                      </Button>
                      {user.id !== currentUser?.id && (
                        <Button variant="ghost" size="icon" className="size-8 text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setUserToDelete(user)}>
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* ===== Desktop Table View ===== */
            <div className="rounded-xl border border-border/70 bg-background/40">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-foreground font-medium">Usuario</TableHead>
                    <TableHead className="text-foreground font-medium">Rol</TableHead>
                    <TableHead className="text-foreground font-medium">Operador Asociado</TableHead>
                    <TableHead className="text-foreground font-medium">Cliente Asociado</TableHead>
                    <TableHead className="text-foreground font-medium">Estado</TableHead>
                    <TableHead className="text-foreground font-medium">Estado Invitación</TableHead>
                    <TableHead className="text-foreground font-medium">Fecha Registro</TableHead>
                    <TableHead className="text-foreground font-medium">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium text-foreground">{user.full_name || 'Sin nombre'}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getRoleBadgeColor(user.role)}>{getRoleLabel(user.role)}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.role === 'client' ? (
                          <span className="text-sm text-muted-foreground">No aplica</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-foreground">
                              {toTitleCase(user.operator_name || 'Sin asignar')}
                            </span>
                            <Dialog open={isOperatorAssignOpen && selectedUser?.id === user.id} onOpenChange={(open) => {
                              setIsOperatorAssignOpen(open);
                              if (!open) setSelectedUser(null);
                            }}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="size-6 p-0" onClick={() => setSelectedUser(user)} disabled={updating === user.id}>
                                  <HardHat className="size-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden border-border/70 bg-card p-0 sm:max-w-lg">
                                <DialogHeader className="border-b border-border/70 px-6 py-4">
                                  <DialogTitle className="text-foreground">Asignar Operador</DialogTitle>
                                </DialogHeader>
                                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                                  <p className="text-sm text-muted-foreground">
                                    Selecciona el operador que será vinculado a este usuario. Para acceder al portal de operadores, el usuario debe tener un operador asociado.
                                  </p>
                                  <div className="space-y-2">
                                    <Button variant="outline" className="w-full justify-start whitespace-normal h-auto py-3" onClick={() => handleAssignOperator(null)}>
                                      Sin operador asignado
                                    </Button>
                                    {operators.map((op) => (
                                      <Button key={op.id} variant="outline" className="w-full justify-start whitespace-normal h-auto py-3 text-left" onClick={() => handleAssignOperator(op.id)}>
                                        {toTitleCase(op.name)} ({op.rut})
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.role === 'client' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-foreground">{toTitleCase(user.client_name || 'Sin asignar')}</span>
                            <Dialog open={isClientAssignOpen && selectedUser?.id === user.id} onOpenChange={(open) => {
                              setIsClientAssignOpen(open);
                              if (!open) setSelectedUser(null);
                            }}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="size-6 p-0" onClick={() => setSelectedUser(user)} disabled={updating === user.id}>
                                  <Settings className="size-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden border-border/70 bg-card p-0 sm:max-w-lg">
                                <DialogHeader className="border-b border-border/70 px-6 py-4">
                                  <DialogTitle className="text-foreground">Asignar Cliente</DialogTitle>
                                </DialogHeader>
                                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                                  <p className="text-sm text-muted-foreground">Selecciona el cliente que será asociado a este usuario:</p>
                                  <div className="space-y-2">
                                    <Button variant="outline" className="w-full justify-start whitespace-normal h-auto py-3" onClick={() => handleAssignClient(null)}>Sin cliente asignado</Button>
                                    {clients.map((client) => (
                                      <Button key={client.id} variant="outline" className="w-full justify-start whitespace-normal h-auto py-3 text-left" onClick={() => handleAssignClient(client.id)}>
                                        <div className="flex flex-col items-start">
                                          <span>{formatClientOption(client).title}</span>
                                          <span className="text-xs text-muted-foreground">{formatClientOption(client).subtitle}</span>
                                        </div>
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No aplica</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-x-2">
                          <Switch checked={user.is_active} onCheckedChange={(checked) => toggleUserStatus(user.id, checked)} disabled={updating === user.id} />
                          <span className={`text-sm ${user.is_active ? 'text-success' : 'text-danger'}`}>
                            {user.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getInvitationStatusBadge(user)}
                          {getInvitationStatus(user.id)?.status === 'sent' && (
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => resendInvitation(user.id)} disabled={sendingInvitation === user.id}>
                              {sendingInvitation === user.id ? <Loader2 className="size-3 animate-spin" /> : 'Reenviar'}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">
                        {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select value={user.role} onValueChange={(newRole) => updateUserRole(user.id, newRole as any)} disabled={updating === user.id}>
                            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="operator">Operador</SelectItem>
                              <SelectItem value="viewer">Visualizador</SelectItem>
                              <SelectItem value="client">Cliente</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10 hover:text-primary" onClick={() => setUserForPermissions(user)} disabled={updating === user.id} title="Configurar permisos de módulos">
                            <Shield className="size-4" />
                          </Button>
                          {user.id !== currentUser?.id && (
                            <Button variant="ghost" size="icon" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setUserToDelete(user)} disabled={updating === user.id}>
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {users.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron usuarios en el sistema.
            </div>
          )}

          <div className="mt-6 rounded-xl border border-border/70 bg-background/50 p-3 sm:p-4">
            <h4 className="text-foreground font-medium mb-2 text-sm">Información sobre Gestión de Usuarios</h4>
            <p className="text-muted-foreground text-xs mb-3">
              Al crear nuevos usuarios, se enviará automáticamente un email de invitación.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="rounded-lg border border-warning/20 bg-warning/10 p-2">
                <strong className="text-warning">Pendiente</strong>
                <p className="text-muted-foreground">Email por enviar</p>
              </div>
              <div className="rounded-lg border border-info/20 bg-info/10 p-2">
                <strong className="text-info">Enviada</strong>
                <p className="text-muted-foreground">Esperando registro</p>
              </div>
              <div className="rounded-lg border border-success/20 bg-success/10 p-2">
                <strong className="text-success">Registrado</strong>
                <p className="text-muted-foreground">Registro completado</p>
              </div>
              <div className="rounded-lg border border-danger/20 bg-danger/10 p-2">
                <strong className="text-danger">Expirada</strong>
                <p className="text-muted-foreground">Invitación venció</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <CreateUserDialog
        open={isCreateUserOpen}
        onOpenChange={setIsCreateUserOpen}
        clients={clients}
        operators={operators}
        onUserCreated={handleUserCreated}
        creating={creating}
        createUser={createUser}
      />

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent className="w-[90vw] max-w-md border-border/70 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta acción eliminará permanentemente al usuario <strong>{userToDelete?.full_name || userToDelete?.email}</strong> y todos sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              disabled={updating === userToDelete?.id}
            >
              {updating === userToDelete?.id ? (
                <><Loader2 className="size-4 mr-2 animate-spin" />Eliminando...</>
              ) : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UserPermissionsModal
        open={!!userForPermissions}
        onOpenChange={(open) => !open && setUserForPermissions(null)}
        user={userForPermissions}
      />
    </div>
  );
};
