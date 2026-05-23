
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AuthValidator } from './authValidator.ts'
import { BackupLogger } from './backupLogger.ts'
import { BackupGenerators } from './backupGenerators.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type BackupFrequency = 'daily' | 'weekly' | 'monthly'

const DEFAULT_TIMEZONE = 'America/Santiago'

const getDatePartsInTimezone = (timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })

  const parts = formatter.formatToParts(new Date())
  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]))

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    weekday: lookup.weekday,
    dateKey: `${lookup.year}-${lookup.month}-${lookup.day}`,
  }
}

const getWeekKey = (year: number, month: number, day: number): string => {
  const reference = new Date(Date.UTC(year, month - 1, day, 12))
  const dayOfWeek = reference.getUTCDay()
  const diffToMonday = (dayOfWeek + 6) % 7
  reference.setUTCDate(reference.getUTCDate() - diffToMonday)
  return reference.toISOString().slice(0, 10)
}

const buildSchedulerPeriod = (frequency: BackupFrequency, timeZone: string) => {
  const dateParts = getDatePartsInTimezone(timeZone)

  if (frequency === 'weekly') {
    return {
      shouldRun: dateParts.weekday === 'Mon',
      periodKey: `week:${getWeekKey(dateParts.year, dateParts.month, dateParts.day)}`,
      label: 'weekly',
    }
  }

  if (frequency === 'monthly') {
    return {
      shouldRun: dateParts.day === 1,
      periodKey: `month:${dateParts.year}-${String(dateParts.month).padStart(2, '0')}`,
      label: 'monthly',
    }
  }

  return {
    shouldRun: true,
    periodKey: `day:${dateParts.dateKey}`,
    label: 'daily',
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const requestSecret = req.headers.get('x-cron-secret');
    const body = await req.json().catch(() => ({}));
    const { force = false } = body;

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    let isScheduledRequest = false
    const configuredCronSecret = Deno.env.get('CRON_SECRET')

    if (requestSecret && configuredCronSecret && requestSecret === configuredCronSecret) {
      isScheduledRequest = true
    }

    if (!isScheduledRequest && requestSecret) {
      const { data: schedulerSecret } = await serviceClient
        .from('internal_scheduler_secrets')
        .select('value')
        .eq('key', 'generate_backup_cron')
        .maybeSingle()

      if (schedulerSecret?.value && schedulerSecret.value === requestSecret) {
        isScheduledRequest = true
      }
    }

    let user: { id?: string; email?: string } | null = null
    let userScopedClient: ReturnType<typeof createClient> | undefined
    let type: 'full' | 'quick' = body.type === 'quick' ? 'quick' : 'full'
    let format: 'json' | 'sql' = body.format === 'sql' ? 'sql' : 'json'
    let logType = `${type}_${format}`
    let startMetadata: Record<string, unknown> = {
      source: isScheduledRequest ? 'scheduler' : 'manual',
      format,
    }

    if (isScheduledRequest) {
      const { data: systemSettings, error: systemError } = await serviceClient
        .from('system_settings')
        .select('auto_backup, backup_frequency')
        .limit(1)
        .maybeSingle()

      if (systemError) {
        throw new Error(`No se pudo leer la configuración de respaldos: ${systemError.message}`)
      }

      if (!systemSettings?.auto_backup && !force) {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'auto_backup_disabled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: companyData } = await serviceClient
        .from('company_data')
        .select('report_timezone')
        .limit(1)
        .maybeSingle()

      const timeZone = companyData?.report_timezone || DEFAULT_TIMEZONE
      const frequency = (systemSettings?.backup_frequency || 'daily') as BackupFrequency
      const schedulerPeriod = buildSchedulerPeriod(frequency, timeZone)

      if (!schedulerPeriod.shouldRun && !force) {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'outside_schedule_window', frequency }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!force) {
        const { data: existingAutoBackup } = await serviceClient
          .from('backup_logs')
          .select('id')
          .eq('backup_type', 'auto')
          .eq('status', 'completed')
          .contains('metadata', {
            source: 'scheduler',
            period_key: schedulerPeriod.periodKey,
          })
          .limit(1)
          .maybeSingle()

        if (existingAutoBackup?.id) {
          return new Response(
            JSON.stringify({ success: true, skipped: true, reason: 'already_generated_for_period', periodKey: schedulerPeriod.periodKey }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      type = 'quick'
      format = 'json'
      logType = 'auto'
      startMetadata = {
        source: 'scheduler',
        format,
        frequency,
        period_key: schedulerPeriod.periodKey,
        time_zone: timeZone,
      }

      user = {
        email: 'scheduler@system.local',
      }
    } else {
      userScopedClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: authHeader! },
          },
        }
      )

      const authValidator = new AuthValidator(userScopedClient);
      const authResult = await authValidator.validateRequest(authHeader);
      user = authResult.user;
    }

    console.log(`Starting ${logType} backup generation (${format} format) for ${isScheduledRequest ? 'scheduler' : user?.email}...`);

    // Initialize logging and generators
    const logger = new BackupLogger(serviceClient);
    const generators = new BackupGenerators(serviceClient, userScopedClient);

    // Start backup log
    const logId = await logger.startLog(logType, user?.id ?? null, startMetadata);

    try {
      let backupResult;

      // Generate backup based on type and format
      if (format === 'sql') {
        backupResult = await generators.generateSQLBackup(user?.email || 'scheduler@system.local');
      } else if (type === 'quick') {
        backupResult = isScheduledRequest
          ? await generators.generateScheduledQuickBackup(user?.email || 'scheduler@system.local')
          : await generators.generateQuickBackup(user?.email || 'scheduler@system.local');
      } else {
        backupResult = await generators.generateFullBackup(user?.email || 'scheduler@system.local');
      }

      // Verify content was generated
      if (!backupResult.content || backupResult.content.length === 0) {
        throw new Error('No se pudo generar el contenido del respaldo');
      }

      // Complete backup log
      if (logId) {
        await logger.completeLog(logId, backupResult.size, {
          ...startMetadata,
          fileName: backupResult.fileName,
          contentType: backupResult.contentType,
          format: format,
          records_count: format === 'sql' ? 'database_dump' : 
                        type === 'quick' ? 'configuration_only' : 'all_tables'
        });
      }

      console.log(`Backup generated successfully: ${backupResult.fileName} (${backupResult.size} bytes)`);

      return new Response(
        JSON.stringify({
          success: true,
          fileName: backupResult.fileName,
          content: backupResult.content,
          size: backupResult.size,
          type: backupResult.contentType,
          format: format
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );

    } catch (error: unknown) {
      console.error('Error generating backup:', error);
      
      // Log error
      if (logId) {
        await logger.failLog(logId, (error as Error).message || 'Error desconocido');
      }

      throw error;
    }

  } catch (error: unknown) {
    console.error('Backup function error:', error);
    
    const errorMessage = (error as Error).message || 'Error interno del servidor';
    const statusCode = (error as Error).message?.includes('administrador') ? 403 : 
                      (error as Error).message?.includes('autenticado') ? 401 : 500;

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
