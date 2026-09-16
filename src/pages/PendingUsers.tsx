import { businessClock } from '@/utils/businessClock';
import { useEffect, useState } from 'react';
import { createLogger } from '@/lib/logger';
import { usePendingUsersFetcher } from '@/hooks/pendingusers/usePendingUsersFetcher';
import { PendingApprovalRole, usePendingUsersManager } from '@/hooks/pendingusers/usePendingUsersManager';
import { useClients } from '@/hooks/useClients';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { CheckCircle, XCircle, Users, Clock, RefreshCw, UserCheck, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import { toTitleCase } from '@/lib/utils';
import type { PendingUser } from '@/types/pendingUsers';

const logger = createLogger('PendingUsers');
logger.info('PendingUsers page mounted');

const ROLE_OPTIONS: { value: PendingApprovalRole; label: string }[] = [
  { value: 'viewer', label: 'Visualizador' },
  { value: 'client', label: 'Cliente' },
  { value: 'operator', label: 'Operador' },
  { value: 'admin', label: 'Administrador' },
];

const AVATAR_COLORS = [
  'bg-success text-success-foreground',
  'bg-info text-info-foreground',
  'bg-primary text-primary-foreground',
  'bg-warning text-warning-foreground',
  'bg-danger text-danger-foreground',
  'bg-info text-info-foreground',
  'bg-primary text-primary-foreground',
  'bg-warning text-warning-foreground',
];

function getAvatarColor(email: string) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export default function PendingUsers() {
  const { data: users = [], isLoading, isFetching, refetch } = usePendingUsersFetcher();
  const { clients, loading: clientsLoading } = useClients();
  const { approveUser, rejectUser } = usePendingUsersManager();
  const isMobile = useIsMobile();
  const [selectedRoles, setSelectedRoles] = useState<Record<string, PendingApprovalRole | ''>>({});
  const [selectedClients, setSelectedClients] = useState<Record<string, string>>({});
  const [userToReject, setUserToReject] = useState<PendingUser | null>(null);
  const activeClients = (() => {
    const seen = new Set<string>();
    return clients
      .filter((client) => client.isActive)
      .filter((client) => {
        const key = `${client.name}|${client.rut}|${client.department || ''}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) =>
        `${a.name} ${a.department || ''}`.localeCompare(`${b.name} ${b.department || ''}`, 'es')
      );
  })();

  useEffect(() => {
    setSelectedRoles((current) => {
      const next = { ...current };
      for (const user of users) {
        if (!next[user.id]) {
          next[user.id] = '';
        }
      }
      return next;
    });
  }, [users]);

  const handleApprove = (userId: string) => {
    const role = selectedRoles[userId];
    const clientId = selectedClients[userId];

    if (!role) return;

    approveUser.mutate({
      userId,
      role,
      clientId: role === 'client' ? clientId || null : null,
    });
  };

  const handleConfirmReject = () => {
    if (userToReject) {
      rejectUser.mutate(userToReject.id);
    }
    setUserToReject(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="pending-users-concept space-y-6 pb-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="dashboard-section-kicker"><Users className="size-3.5" />Gobierno de acceso</span>
          <h1 className="dashboard-section-title">Usuarios Pendientes</h1>
          <p className="dashboard-section-description">Solicitudes de acceso, asignación de rol y vínculo con clientes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`mr-2 size-4 ${isFetching ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
        {users.length > 0 && (
          <Badge variant="destructive">
            {users.length} pendiente{users.length !== 1 ? 's' : ''}
          </Badge>
        )}
        </div>
      </div>

      {users.length === 0 && (
        <Card className="configuration-panel">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <UserCheck className="size-12 text-success-text opacity-60" />
            <p className="font-medium text-foreground">No hay solicitudes pendientes</p>
            <p className="text-sm text-muted-foreground">
              Los nuevos usuarios aparecerán aquí cuando se registren
            </p>
          </CardContent>
        </Card>
      )}

      {users.length > 0 && (
        <div className="space-y-3">
          {users.map((user) => {
            const selectedRole = selectedRoles[user.id] || '';
            const selectedClient = selectedClients[user.id] || '';
            const requiresClient = selectedRole === 'client';
            const isApprovingThisUser =
              approveUser.isPending && approveUser.variables?.userId === user.id;
            const isRejectingThisUser =
              rejectUser.isPending && rejectUser.variables === user.id;
            const canApprove =
              !!selectedRole &&
              (!requiresClient || !!selectedClient) &&
              !approveUser.isPending &&
              !(requiresClient && activeClients.length === 0);

            return (
              <Card key={user.id} className="configuration-panel">
                <CardContent className="p-4">
                  <div className={`flex ${isMobile ? 'flex-col gap-4' : 'items-start gap-4'}`}>
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${getAvatarColor(user.email)}`}
                        aria-hidden="true"
                      >
                        {getInitials(user.email)}
                      </div>

                      <div className="space-y-3 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground truncate">{user.email}</p>
                          <Badge variant="warning" className="flex items-center gap-1">
                            <Clock className="size-3" />
                            Pendiente
                          </Badge>
                        </div>
                        {user.full_name && (
                          <p className="text-sm text-foreground/80">{user.full_name}</p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          Solicitó acceso el{' '}
                          {businessClock.format(user.created_at, "d MMM yyyy 'a las' HH:mm", { locale: es })}
                        </p>
                        {(user.company || user.rut || user.phone) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {user.company && <span>🏢 {user.company}</span>}
                            {user.rut && <span>🪪 {user.rut}</span>}
                            {user.phone && <span>📞 {user.phone}</span>}
                          </div>
                        )}

                        <div className={`flex gap-3 ${isMobile ? 'flex-col' : 'flex-wrap items-end'}`}>
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground">Rol a asignar</p>
                            <Select
                              value={selectedRole}
                              onValueChange={(value: PendingApprovalRole) => {
                                setSelectedRoles((current) => ({ ...current, [user.id]: value }));
                                if (value !== 'client') {
                                  setSelectedClients((current) => ({ ...current, [user.id]: '' }));
                                }
                              }}
                              disabled={approveUser.isPending}
                            >
                              <SelectTrigger
                                className={`border-border/70 bg-background/60 ${isMobile ? 'w-full' : 'w-52'}`}
                              >
                                <SelectValue placeholder="Seleccionar rol" />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLE_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {requiresClient && (
                            <div className="space-y-1.5">
                              <p className="text-xs text-muted-foreground">Cliente asociado</p>
                              <Select
                                value={selectedClient}
                                onValueChange={(value) => {
                                  setSelectedClients((current) => ({ ...current, [user.id]: value }));
                                }}
                                disabled={approveUser.isPending || clientsLoading || activeClients.length === 0}
                              >
                                <SelectTrigger
                                  className={`border-border/70 bg-background/60 ${isMobile ? 'w-full' : 'w-64'}`}
                                >
                                  <SelectValue
                                    placeholder={
                                      clientsLoading
                                        ? 'Cargando clientes...'
                                        : activeClients.length === 0
                                          ? 'No hay clientes activos'
                                          : 'Seleccionar cliente'
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {activeClients.map((client) => (
                                    <SelectItem key={client.id} value={client.id}>
                                      {toTitleCase(client.name)} - {client.rut}
                                      {client.department ? ` - ${client.department}` : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>

                        {requiresClient && (
                          <p className="text-xs text-warning-text">
                            Para aprobar como cliente debes vincular un cliente activo.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className={`flex gap-2 ${isMobile ? 'w-full' : 'shrink-0'}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className={`border-danger/40 text-danger-text hover:bg-danger-soft ${isMobile ? 'flex-1' : ''}`}
                        disabled={rejectUser.isPending}
                        onClick={() => setUserToReject(user)}
                      >
                        {isRejectingThisUser ? (
                          <Loader2 className="size-4 mr-1 animate-spin" />
                        ) : (
                          <XCircle className="size-4 mr-1" />
                        )}
                        Rechazar
                      </Button>
                      <Button
                        size="sm"
                        className={`bg-success text-success-foreground hover:bg-success/90 ${isMobile ? 'flex-1' : ''}`}
                        disabled={!canApprove}
                        onClick={() => handleApprove(user.id)}
                      >
                        {isApprovingThisUser ? (
                          <Loader2 className="size-4 mr-1 animate-spin" />
                        ) : (
                          <CheckCircle className="size-4 mr-1" />
                        )}
                        Aprobar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!userToReject} onOpenChange={(open) => !open && setUserToReject(null)}>
        <AlertDialogContent className="configuration-dialog w-[90vw] max-w-md border-border/70 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Rechazar solicitud?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              ¿Estás seguro? Esta acción eliminará la solicitud de acceso de{' '}
              <span className="font-medium text-foreground">{userToReject?.email}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={handleConfirmReject}
            >
              Rechazar solicitud
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
