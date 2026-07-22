import { supabase } from '@/integrations/supabase/client'
import { AuthBackground } from '@/components/auth/AuthBackground'
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { isOperatorMobileVariant } from '@/lib/appVariant'
import { Navigate } from 'react-router-dom'
import { Clock, Loader2 } from 'lucide-react'

export default function PendingApproval() {
  const { user, loading } = useAuth()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }

  if (loading) {
    return (
      <AuthBackground variant={isOperatorMobileVariant() ? 'operator' : 'default'}>
        <Loader2 className="size-8 animate-spin text-auth-foreground" />
      </AuthBackground>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return (
    <AuthBackground variant={isOperatorMobileVariant() ? 'operator' : 'default'}>
      <div className="w-full max-w-md space-y-4">
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

        <DeleteAccountSection />
      </div>
    </AuthBackground>
  )
}
