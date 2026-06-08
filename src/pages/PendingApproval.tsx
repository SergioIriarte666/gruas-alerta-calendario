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
      <div className="w-full max-w-[400px]">
        <Card className="border-white/15 bg-white/10 shadow-2xl backdrop-blur-xl">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <Clock className="mx-auto size-12 text-amber-400" />
            <h2 className="text-xl font-semibold text-white">Cuenta pendiente de aprobación</h2>
            <p className="text-sm text-white/65">
              Tu solicitud está siendo revisada por el administrador. Te notificaremos cuando tu acceso sea activado.
            </p>
            <Button
              variant="outline"
              className="w-full rounded-xl border-white/15 bg-white/8 text-white hover:bg-white/15 mt-2"
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
