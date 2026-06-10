import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { createLogger } from '@/lib/logger'
import { AuthBackground } from '@/components/auth/AuthBackground'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatRut } from '@/utils/rutFormatter'
import { CheckCircle2, Loader2 } from 'lucide-react'

const logger = createLogger('Register')

const rutRegex = /^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/

const schema = z.object({
  full_name: z.string().min(3, 'Nombre completo requerido'),
  phone: z.string().regex(/^\+56\d{9}$/, 'Formato requerido: +56XXXXXXXXX'),
  company: z.string().min(2, 'Empresa requerida'),
  rut: z.string().regex(rutRegex, 'Formato requerido: X.XXX.XXX-X o XX.XXX.XXX-X'),
})

type FormValues = z.infer<typeof schema>

export default function Register() {
  const [submitted, setSubmitted] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      toast.error('Sesión no válida. Por favor, inicia sesión nuevamente.')
      return
    }

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .maybeSingle()

    if (existingProfileError) {
      logger.error('Register existing profile lookup error', existingProfileError)
      toast.error('Error al validar el estado de tu cuenta: ' + existingProfileError.message)
      return
    }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email!,
      full_name: values.full_name,
      phone: values.phone,
      company: values.company,
      rut: values.rut,
      status: existingProfile?.status ?? 'pending',
      role: existingProfile?.role ?? 'viewer',
    })

    if (error) {
      logger.error('Register upsert error', error)
      toast.error('Error al enviar solicitud: ' + error.message)
      return
    }

    logger.info('Register submitted for user', user.id)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <AuthBackground>
        <div className="w-full max-w-[400px]">
          <Card className="border-white/15 bg-white/10 shadow-2xl backdrop-blur-xl">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <CheckCircle2 className="mx-auto size-12 text-emerald-400" />
              <h2 className="text-xl font-semibold text-white">Solicitud enviada</h2>
              <p className="text-sm text-white/65">
                Tu solicitud fue enviada correctamente. El administrador revisará tu acceso y te notificará cuando tu cuenta esté activa.
              </p>
              <Button
                variant="outline"
                className="w-full rounded-xl border-white/15 bg-white/8 text-white hover:bg-white/15 mt-2"
                onClick={async () => {
                  await supabase.auth.signOut()
                  window.location.href = '/auth'
                }}
              >
                Cerrar sesión
              </Button>
            </CardContent>
          </Card>
        </div>
      </AuthBackground>
    )
  }

  return (
    <AuthBackground>
      <div className="w-full max-w-[400px] space-y-4">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-white">Completa tu registro</h1>
          <p className="text-sm text-white/65">Necesitamos algunos datos adicionales para activar tu cuenta.</p>
        </div>
        <Card className="border-white/15 bg-white/10 shadow-2xl backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">Datos de contacto</CardTitle>
            <CardDescription className="text-white/65">El administrador los usará para verificar tu identidad.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/85">Nombre completo</Label>
                <Input
                  {...register('full_name')}
                  placeholder="Juan Pérez"
                  className="h-11 rounded-xl border-white/15 bg-white/8 text-white placeholder:text-white/45 focus:border-white/40"
                />
                {errors.full_name && <p className="text-xs text-red-400">{errors.full_name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-white/85">Teléfono</Label>
                <Input
                  {...register('phone')}
                  placeholder="+56912345678"
                  className="h-11 rounded-xl border-white/15 bg-white/8 text-white placeholder:text-white/45 focus:border-white/40"
                />
                {errors.phone && <p className="text-xs text-red-400">{errors.phone.message}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-white/85">Empresa</Label>
                <Input
                  {...register('company')}
                  placeholder="Grúas del Norte SpA"
                  className="h-11 rounded-xl border-white/15 bg-white/8 text-white placeholder:text-white/45 focus:border-white/40"
                />
                {errors.company && <p className="text-xs text-red-400">{errors.company.message}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-white/85">RUT</Label>
                <Input
                  {...register('rut', {
                    onChange: (event) => {
                      event.target.value = formatRut(event.target.value)
                    },
                  })}
                  placeholder="9.999.999-9 o 12.345.678-9"
                  className="h-11 rounded-xl border-white/15 bg-white/8 text-white placeholder:text-white/45 focus:border-white/40"
                />
                {errors.rut && <p className="text-xs text-red-400">{errors.rut.message}</p>}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <><Loader2 className="mr-2 size-4 animate-spin" />Enviando...</>
                ) : (
                  'Enviar solicitud'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AuthBackground>
  )
}
