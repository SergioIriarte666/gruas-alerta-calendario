import { supabase } from '@/integrations/supabase/client'
import { AuthBackground } from '@/components/auth/AuthBackground'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock } from 'lucide-react'

export default function PendingApproval() {
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }

  return (
    <AuthBackground>
      <div className="w-full max-w-md">
        <Card className="border-auth-border/15 bg-auth-surface/10 shadow-2xl backdrop-blur-xl">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <Clock className="mx-auto size-12 text-auth-warning" />
            <h2 className="text-xl font-semibold text-auth-foreground drop-shadow-md">
              Cuenta pendiente de aprobación
            </h2>
            <p className="text-sm leading-6 text-auth-muted">
              Tu solicitud está siendo revisada por el administrador. Te notificaremos cuando tu acceso sea activado.
            </p>
            <Button
              type="button"
              className="mt-2 w-full rounded-xl border border-auth-border/15 bg-auth-surface/10 text-auth-foreground hover:bg-auth-surface/15"
              onClick={handleSignOut}
            >
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    </AuthBackground>
  )
}
