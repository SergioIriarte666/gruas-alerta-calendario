
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
    // Verificar que hay un token de autorización
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Verificar que el usuario esté autenticado
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Usuario no autenticado');
    }

    // Verificar que el usuario sea administrador
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      throw new Error('Solo los administradores pueden generar respaldos');
    }

    const body = await req.json();
    const { type = 'full' } = body;

    console.log(`Starting ${type} backup generation for user ${user.email}...`);

    // Log inicio del respaldo
    const { data: logData, error: logError } = await supabaseClient
      .from('backup_logs')
      .insert({
        backup_type: type,
        status: 'started',
        created_by: user.id
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating backup log:', logError);
      // Continuar aunque no se pueda crear el log
    }

    const logId = logData?.id;

    try {
      let backupContent: string;
      let fileName: string;
      let contentType: string;

      if (type === 'quick') {
        // Generar respaldo rápido (JSON)
        const { data: quickBackup, error } = await supabaseClient
          .rpc('generate_quick_backup');

        if (error) {
          console.error('Error generating quick backup:', error);
          throw error;
        }

        backupContent = JSON.stringify(quickBackup, null, 2);
        fileName = `tms-gruas-quick-backup-${new Date().toISOString().split('T')[0]}.json`;
        contentType = 'application/json';
      } else {
        // Generar respaldo completo (SQL)
        const { data: fullBackup, error } = await supabaseClient
          .rpc('generate_database_backup');

        if (error) {
          console.error('Error generating full backup:', error);
          throw error;
        }

        backupContent = fullBackup;
        fileName = `tms-gruas-full-backup-${new Date().toISOString().split('T')[0]}.sql`;
        contentType = 'application/sql';
      }

      // Verificar que se generó contenido
      if (!backupContent || backupContent.length === 0) {
        throw new Error('No se pudo generar el contenido del respaldo');
      }

      // Actualizar log como completado
      if (logId) {
        const { error: updateError } = await supabaseClient
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
          .eq('id', logId);

        if (updateError) {
          console.error('Error updating backup log:', updateError);
        }
      }

      console.log(`Backup generated successfully: ${fileName} (${new Blob([backupContent]).size} bytes)`);

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
      );

    } catch (error) {
      console.error('Error generating backup:', error);
      
      // Log error
      if (logId) {
        const { error: updateError } = await supabaseClient
          .from('backup_logs')
          .update({
            status: 'failed',
            error_message: error.message || 'Error desconocido'
          })
          .eq('id', logId);

        if (updateError) {
          console.error('Error updating backup log with error:', updateError);
        }
      }

      throw error;
    }

  } catch (error) {
    console.error('Backup function error:', error);
    
    const errorMessage = error.message || 'Error interno del servidor';
    const statusCode = error.message?.includes('administrador') ? 403 : 
                      error.message?.includes('autenticado') ? 401 : 500;

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: statusCode,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
