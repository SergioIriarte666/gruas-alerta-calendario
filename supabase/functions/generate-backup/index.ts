
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { type = 'full' } = await req.json()

    console.log(`Starting ${type} backup generation...`)

    // Log inicio del respaldo
    const { data: logData } = await supabaseClient
      .from('backup_logs')
      .insert({
        backup_type: type,
        status: 'started'
      })
      .select()
      .single()

    const logId = logData?.id

    try {
      let backupContent: string
      let fileName: string
      let contentType: string

      if (type === 'quick') {
        // Generar respaldo rápido (JSON)
        const { data: quickBackup, error } = await supabaseClient
          .rpc('generate_quick_backup')

        if (error) throw error

        backupContent = JSON.stringify(quickBackup, null, 2)
        fileName = `tms-gruas-quick-backup-${new Date().toISOString().split('T')[0]}.json`
        contentType = 'application/json'
      } else {
        // Generar respaldo completo (SQL)
        const { data: fullBackup, error } = await supabaseClient
          .rpc('generate_database_backup')

        if (error) throw error

        backupContent = fullBackup
        fileName = `tms-gruas-full-backup-${new Date().toISOString().split('T')[0]}.sql`
        contentType = 'application/sql'
      }

      // Actualizar log como completado
      if (logId) {
        await supabaseClient
          .from('backup_logs')
          .update({
            status: 'completed',
            file_size_bytes: new Blob([backupContent]).size,
            metadata: {
              fileName,
              contentType,
              records_count: type === 'quick' ? 'configuration_only' : 'all_tables'
            }
          })
          .eq('id', logId)
      }

      console.log(`Backup generated successfully: ${fileName}`)

      return new Response(
        JSON.stringify({
          success: true,
          fileName,
          content: backupContent,
          size: new Blob([backupContent]).size,
          type: contentType
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )

    } catch (error) {
      console.error('Error generating backup:', error)
      
      // Log error
      if (logId) {
        await supabaseClient
          .from('backup_logs')
          .update({
            status: 'failed',
            error_message: error.message
          })
          .eq('id', logId)
      }

      throw error
    }

  } catch (error) {
    console.error('Backup function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error interno del servidor'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
