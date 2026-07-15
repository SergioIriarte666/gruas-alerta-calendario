
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface BackupResult {
  content: string;
  fileName: string;
  contentType: string;
  size: number;
}

type QuickBackupPayload = {
  company_data: Record<string, unknown> | null;
  system_settings: Record<string, unknown> | null;
  metadata: {
    generated_at: string;
    generated_by: string;
    counts: {
      clients: number;
      services: number;
      operators: number;
      cranes: number;
      invoices: number;
    };
  };
}

export class BackupGenerators {
  constructor(
    private privilegedClient: SupabaseClient,
    private userClient?: SupabaseClient,
  ) {}

  private buildJsonBackupResult(contentData: unknown, fileName: string): BackupResult {
    const content = JSON.stringify(contentData, null, 2);

    return {
      content,
      fileName,
      contentType: 'application/json',
      size: new Blob([content]).size
    };
  }

  private async buildQuickBackupPayload(userEmail: string): Promise<QuickBackupPayload> {
    const [
      { data: companyData, error: companyError },
      { data: systemSettings, error: settingsError },
      { count: clientsCount, error: clientsError },
      { count: servicesCount, error: servicesError },
      { count: operatorsCount, error: operatorsError },
      { count: cranesCount, error: cranesError },
      { count: invoicesCount, error: invoicesError },
    ] = await Promise.all([
      this.privilegedClient
        .from('company_data')
        .select('*')
        .limit(1)
        .maybeSingle(),
      this.privilegedClient
        .from('system_settings')
        .select('*')
        .limit(1)
        .maybeSingle(),
      this.privilegedClient
        .from('clients')
        .select('*', { count: 'exact', head: true }),
      this.privilegedClient
        .from('services')
        .select('*', { count: 'exact', head: true }),
      this.privilegedClient
        .from('operators')
        .select('*', { count: 'exact', head: true }),
      this.privilegedClient
        .from('cranes')
        .select('*', { count: 'exact', head: true }),
      this.privilegedClient
        .from('invoices')
        .select('*', { count: 'exact', head: true }),
    ]);

    const queryErrors = [
      companyError,
      settingsError,
      clientsError,
      servicesError,
      operatorsError,
      cranesError,
      invoicesError,
    ].filter(Boolean);

    if (queryErrors.length > 0) {
      throw new Error(`No se pudo generar el respaldo rapido: ${queryErrors[0]?.message}`);
    }

    return {
      company_data: companyData as Record<string, unknown> | null,
      system_settings: systemSettings as Record<string, unknown> | null,
      metadata: {
        generated_at: new Date().toISOString(),
        generated_by: userEmail,
        counts: {
          clients: clientsCount ?? 0,
          services: servicesCount ?? 0,
          operators: operatorsCount ?? 0,
          cranes: cranesCount ?? 0,
          invoices: invoicesCount ?? 0,
        },
      },
    };
  }

  async generateQuickBackup(_userEmail: string): Promise<BackupResult> {
    if (!this.userClient) {
      throw new Error('Se requiere un administrador autenticado para generar el respaldo rapido manual');
    }

    const { data: quickBackup, error } = await this.userClient
      .rpc('generate_quick_backup');

    if (error) {
      console.error('Error generating quick backup:', error);
      throw error;
    }

    const fileName = `tms-gruas-quick-backup-${new Date().toISOString().split('T')[0]}.json`;

    return this.buildJsonBackupResult(quickBackup, fileName);
  }

  async generateScheduledQuickBackup(userEmail: string): Promise<BackupResult> {
    const quickBackup = await this.buildQuickBackupPayload(userEmail);
    const fileName = `tms-gruas-auto-backup-${new Date().toISOString().split('T')[0]}.json`;

    return this.buildJsonBackupResult(quickBackup, fileName);
  }

  async generateFullBackup(userEmail: string): Promise<BackupResult> {
    const tables = [
      'profiles', 'clients', 'service_types', 'cranes', 'operators',
      'services', 'costs', 'cost_categories', 'company_data', 'system_settings'
    ];
    
    const backupData: any = {
      metadata: {
        generated_at: new Date().toISOString(),
        generated_by: userEmail,
        backup_type: 'full',
        version: '1.0'
      },
      data: {}
    };

    // Export data from each table
    for (const table of tables) {
      try {
        const { data, error } = await this.privilegedClient
          .from(table)
          .select('*');
        
        if (error) {
          console.error(`Error fetching ${table}:`, error);
          backupData.data[table] = { error: error.message, count: 0 };
        } else {
          backupData.data[table] = { records: data || [], count: data?.length || 0 };
        }
      } catch (e) {
        console.error(`Exception fetching ${table}:`, e);
        backupData.data[table] = { error: (e as Error).message, count: 0 };
      }
    }

    const content = JSON.stringify(backupData, null, 2);
    const fileName = `tms-gruas-full-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    return {
      content,
      fileName,
      contentType: 'application/json',
      size: new Blob([content]).size
    };
  }

  async generateSQLBackup(userEmail: string): Promise<BackupResult> {
    try {
      const tables = [
        'profiles', 'clients', 'service_types', 'cranes', 'operators',
        'services', 'costs', 'cost_categories', 'company_data', 'system_settings'
      ];

      const parts: string[] = [];
      parts.push('-- TMS Gruas - Respaldo SQL Completo');
      parts.push(`-- Generado el: ${new Date().toISOString()}`);
      parts.push(`-- Por usuario: ${userEmail}`);
      parts.push(`-- Tablas: ${tables.join(', ')}`);
      parts.push('');

      const BATCH = 1000;

      for (const table of tables) {
        parts.push(`-- =====================================================`);
        parts.push(`-- Tabla: public.${table}`);
        parts.push(`-- =====================================================`);

        try {
          let from = 0;
          let totalRows = 0;
          let columns: string[] | null = null;

          while (true) {
            const { data, error } = await this.privilegedClient
              .from(table)
              .select('*')
              .range(from, from + BATCH - 1);

            if (error) {
              parts.push(`-- ERROR leyendo ${table}: ${error.message}`);
              break;
            }

            if (!data || data.length === 0) break;

            if (!columns && data.length > 0) {
              columns = Object.keys(data[0] as Record<string, unknown>);
            }

            if (columns) {
              const colList = columns.map(quoteIdent).join(', ');
              for (const row of data as Record<string, unknown>[]) {
                const values = columns.map((c) => sqlLiteral(row[c])).join(', ');
                parts.push(`INSERT INTO public.${quoteIdent(table)} (${colList}) VALUES (${values});`);
              }
            }

            totalRows += data.length;
            if (data.length < BATCH) break;
            from += BATCH;
          }

          parts.push(`-- ${totalRows} filas exportadas de ${table}`);
          parts.push('');
        } catch (e) {
          parts.push(`-- EXCEPCIÓN en ${table}: ${(e as Error).message}`);
          parts.push('');
        }
      }

      parts.push('-- Respaldo completado exitosamente');

      const content = parts.join('\n');
      const fileName = `tms-gruas-sql-backup-${new Date().toISOString().split('T')[0]}.sql`;

      return {
        content,
        fileName,
        contentType: 'application/sql',
        size: new Blob([content]).size
      };
    } catch (error) {
      console.error('Exception generating SQL backup:', error);
      throw error;
    }
  }
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL';
  }
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) {
    return `'${value.toISOString()}'::timestamptz`;
  }
  if (typeof value === 'object') {
    const json = JSON.stringify(value).replace(/'/g, "''");
    return `'${json}'::jsonb`;
  }
  const str = String(value).replace(/'/g, "''");
  // Detect ISO timestamp strings to cast appropriately
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str)) {
    return `'${str}'::timestamptz`;
  }
  return `'${str}'`;
}
