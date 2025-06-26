
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AuthValidator } from './authValidator.ts'
import { BackupLogger } from './backupLogger.ts'
import { BackupGenerators } from './backupGenerators.ts'

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
    const authHeader = req.headers.get('Authorization');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Validate authentication and authorization
    const authValidator = new AuthValidator(supabaseClient);
    const { user } = await authValidator.validateRequest(authHeader);

    const body = await req.json();
    const { type = 'full' } = body;

    console.log(`Starting ${type} backup generation for user ${user.email}...`);

    // Initialize logging and generators
    const logger = new BackupLogger(supabaseClient);
    const generators = new BackupGenerators(supabaseClient);

    // Start backup log
    const logId = await logger.startLog(type, user.id);

    try {
      // Generate backup based on type
      const backupResult = type === 'quick' 
        ? await generators.generateQuickBackup(user.email)
        : await generators.generateFullBackup(user.email);

      // Verify content was generated
      if (!backupResult.content || backupResult.content.length === 0) {
        throw new Error('No se pudo generar el contenido del respaldo');
      }

      // Complete backup log
      if (logId) {
        await logger.completeLog(logId, backupResult.size, {
          fileName: backupResult.fileName,
          contentType: backupResult.contentType,
          records_count: type === 'quick' ? 'configuration_only' : 'all_tables'
        });
      }

      console.log(`Backup generated successfully: ${backupResult.fileName} (${backupResult.size} bytes)`);

      return new Response(
        JSON.stringify({
          success: true,
          fileName: backupResult.fileName,
          content: backupResult.content,
          size: backupResult.size,
          type: backupResult.contentType
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
        await logger.failLog(logId, error.message || 'Error desconocido');
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
