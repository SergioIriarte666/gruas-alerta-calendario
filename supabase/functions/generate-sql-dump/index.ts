import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { getCorsHeaders } from '../_shared/cors.ts'

interface DumpOptions {
  includeData: boolean;
  includeStructure: boolean;
  compressionLevel: number;
  tables?: string[];
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar autenticación
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Verificar rol de admin contra la tabla autoritativa user_roles (consistente con RLS)
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleRow) {
      throw new Error('Admin access required');
    }

    const { includeData = true, includeStructure = true, tables } = await req.json() as DumpOptions;

    console.log('Starting SQL dump generation...');

    // Tablas relacionadas con comisiones y servicios
    const commissionTables = [
      'services',
      'service_resources', 
      'costs',
      'operators',
      'cost_categories',
      'clients',
      'cranes',
      'service_types',
      'profiles'
    ];

    const tablesToDump = tables || commissionTables;
    let sqlDump = '';
    
    // Agregar header del dump
    const timestamp = new Date().toISOString();
    sqlDump += `-- SQL Dump generado el ${timestamp}\n`;
    sqlDump += `-- Proyecto: Crane Management System\n`;
    sqlDump += `-- Tablas incluidas: ${tablesToDump.join(', ')}\n\n`;

    // Log de inicio
    const { data: logEntry } = await supabase
      .from('backup_logs')
      .insert({
        backup_type: 'full_sql',
        status: 'started',
        created_by: user.id,
        metadata: {
          format: 'sql',
          tables: tablesToDump
        }
      })
      .select()
      .single();

    let totalRecords = 0;

    for (const table of tablesToDump) {
      try {
        console.log(`Processing table: ${table}`);

        // Obtener estructura de la tabla si se solicita
        if (includeStructure) {
          const { data: tableInfo } = await supabase
            .rpc('get_table_structure', { table_name: table })
            .single();

          if (tableInfo) {
            sqlDump += `-- Estructura de tabla: ${table}\n`;
            sqlDump += `${tableInfo.create_statement}\n\n`;
          }
        }

        // Obtener datos si se solicita
        if (includeData) {
          const { data: tableData, error: tableError } = await supabase
            .from(table)
            .select('*')
            .order('created_at', { ascending: true });

          if (tableError) {
            console.warn(`Error reading table ${table}:`, tableError);
            sqlDump += `-- ERROR: No se pudo leer la tabla ${table}: ${tableError.message}\n\n`;
            continue;
          }

          if (tableData && tableData.length > 0) {
            sqlDump += `-- Datos de tabla: ${table} (${tableData.length} registros)\n`;
            
            // Generar INSERT statements
            const columns = Object.keys(tableData[0]);
            const columnsList = columns.map(col => `"${col}"`).join(', ');
            
            for (const row of tableData) {
              const values = columns.map(col => {
                const value = row[col];
                if (value === null) return 'NULL';
                if (typeof value === 'string') {
                  return `'${value.replace(/'/g, "''")}'`;
                }
                if (typeof value === 'object') {
                  return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
                }
                return String(value);
              }).join(', ');

              sqlDump += `INSERT INTO public."${table}" (${columnsList}) VALUES (${values});\n`;
            }
            
            sqlDump += `\n`;
            totalRecords += tableData.length;
          } else {
            sqlDump += `-- Tabla ${table} está vacía\n\n`;
          }
        }
      } catch (error) {
        console.error(`Error processing table ${table}:`, error);
        sqlDump += `-- ERROR procesando tabla ${table}: ${error.message}\n\n`;
      }
    }

    // Agregar footer
    sqlDump += `-- Dump completado: ${totalRecords} registros totales\n`;
    sqlDump += `-- Generado el: ${timestamp}\n`;

    // Calcular tamaño
    const sizeBytes = new TextEncoder().encode(sqlDump).length;
    
    // Actualizar log de backup
    await supabase
      .from('backup_logs')
      .update({
        status: 'completed',
        file_size_bytes: sizeBytes,
        metadata: {
          format: 'sql',
          tables: tablesToDump,
          records_count: totalRecords,
          fileName: `dump_${timestamp.replace(/[:.]/g, '-')}.sql`
        }
      })
      .eq('id', logEntry?.id);

    console.log(`SQL dump generated successfully. Size: ${sizeBytes} bytes, Records: ${totalRecords}`);

    return new Response(
      JSON.stringify({
        success: true,
        sqlDump,
        metadata: {
          timestamp,
          sizeBytes,
          recordsCount: totalRecords,
          tablesIncluded: tablesToDump.length,
          fileName: `dump_${timestamp.replace(/[:.]/g, '-')}.sql`
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error generating SQL dump:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});