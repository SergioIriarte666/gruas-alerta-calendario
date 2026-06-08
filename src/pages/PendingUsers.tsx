import { createLogger } from '@/lib/logger';
import { usePendingUsersFetcher } from '@/hooks/pendingusers/usePendingUsersFetcher';
import { usePendingUsersManager } from '@/hooks/pendingusers/usePendingUsersManager';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, XCircle, Users, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';

const logger = createLogger('PendingUsers');
logger.info('PendingUsers page mounted');

export default function PendingUsers() {
  const { data: users = [], isLoading } = usePendingUsersFetcher();
  const { approveUser, rejectUser } = usePendingUsersManager();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Users className="size-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuarios Pendientes</h1>
          <p className="text-sm text-muted-foreground">
            Solicitudes de acceso que requieren aprobación
          </p>
        </div>
        {users.length > 0 && (
          <Badge variant="destructive" className="ml-auto">
            {users.length} pendiente{users.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {users.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <CheckCircle className="size-12 text-emerald-500 opacity-60" />
            <p className="text-muted-foreground">No hay usuarios pendientes de aprobación</p>
          </CardContent>
        </Card>
      )}

      {users.length > 0 && (
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-4">
                <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'}`}>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">
                        {user.full_name || 'Sin nombre'}
                      </p>
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <Clock className="size-3" />
                        Pendiente
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {user.company && <span>🏢 {user.company}</span>}
                      {user.rut && <span>🪪 {user.rut}</span>}
                      {user.phone && <span>📞 {user.phone}</span>}
                      <span>
                        Solicitó:{' '}
                        {format(new Date(user.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                      </span>
                    </div>
                  </div>

                  <div className={`flex gap-2 ${isMobile ? 'w-full' : ''}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`border-red-500/40 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 ${isMobile ? 'flex-1' : ''}`}
                      disabled={rejectUser.isPending}
                      onClick={() => rejectUser.mutate(user.id)}
                    >
                      <XCircle className="size-4 mr-1" />
                      Rechazar
                    </Button>
                    <Button
                      size="sm"
                      className={`bg-emerald-600 hover:bg-emerald-700 text-white ${isMobile ? 'flex-1' : ''}`}
                      disabled={approveUser.isPending}
                      onClick={() => approveUser.mutate(user.id)}
                    >
                      <CheckCircle className="size-4 mr-1" />
                      Aprobar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
