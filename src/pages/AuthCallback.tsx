import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AuthCallback')

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        logger.error('OAuth callback error', error)
        navigate('/auth')
        return
      }

      if (!session) {
        navigate('/auth')
        return
      }

      logger.info('OAuth session OK, uid:', session.user.id)

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, status')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile) {
        logger.info('No profile found, redirecting to /register')
        navigate('/register')
        return
      }

      if (profile.status === 'pending') {
        logger.info('Profile pending approval')
        navigate('/pending')
      } else if (profile.status === 'rejected') {
        logger.warn('Profile rejected')
        navigate('/auth?error=rejected')
      } else {
        navigate('/')
      }
    })
  }, [navigate])

  return (
    <div className="flex h-screen items-center justify-center bg-auth-background">
      <p className="text-sm text-auth-muted/70">Iniciando sesión...</p>
    </div>
  )
}
