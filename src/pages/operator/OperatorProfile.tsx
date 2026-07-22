import { ArrowLeft, BadgeCheck, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection';
import { useUser } from '@/contexts/UserContext';

const getInitials = (name?: string) => {
  if (!name) return 'OP';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const OperatorProfile = () => {
  const { user } = useUser();
  const displayName = user?.operator_name || user?.name || 'Operador';

  return (
    <div className="space-y-5 pb-4">
      <section className="operator-native-hero overflow-hidden">
        <div className="relative z-10">
          <Link
            to="/operator"
            className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"
          >
            <ArrowLeft className="size-4" />
            Volver al inicio
          </Link>

          <div className="flex items-center gap-4">
            <Avatar className="size-16 border-2 border-background shadow-sm">
              <AvatarImage src={user?.avatar_url || undefined} alt={displayName} />
              <AvatarFallback className="bg-primary text-lg font-bold text-primary-foreground">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="operator-native-eyebrow">Mi perfil</p>
              <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">{displayName}</h1>
              <Badge variant="outline" className="mt-2 border-primary/25 bg-primary/10 text-primary">
                <BadgeCheck className="mr-1 size-3.5" />
                Operador activo
              </Badge>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="account-details-title">
        <div className="px-1">
          <p className="operator-native-eyebrow">Cuenta</p>
          <h2 id="account-details-title" className="text-xl font-bold text-foreground">Datos de acceso</h2>
        </div>

        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardContent className="divide-y divide-border/60 p-0">
            <div className="flex items-center gap-3 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserRound className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nombre</p>
                <p className="truncate font-semibold text-foreground">{displayName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Mail className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Correo</p>
                <p className="truncate font-semibold text-foreground">{user?.email || 'Sin correo registrado'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seguridad</p>
                <p className="font-semibold text-foreground">Sesión protegida por Supabase Auth</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3" aria-labelledby="privacy-title">
        <div className="px-1">
          <p className="operator-native-eyebrow">Privacidad</p>
          <h2 id="privacy-title" className="text-xl font-bold text-foreground">Control de la cuenta</h2>
        </div>
        <DeleteAccountSection />
      </section>
    </div>
  );
};

export default OperatorProfile;
