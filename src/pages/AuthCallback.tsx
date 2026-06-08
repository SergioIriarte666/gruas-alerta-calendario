import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AuthCallback')

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        logger.error('OAuth callback error', error)
        navigate('/auth')
      } else if (session) {
        logger.info('OAuth session OK, uid:', session.user.id)
        navigate('/')
      } else {
        navigate('/auth')
      }
    })
  }, [navigate])

  return (
    <div className="flex items-center justify-center h-screen bg-slate-950">
      <p className="text-white/60 text-sm">Iniciando sesión...</p>
    </div>
  )
}
