
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface BackupResult {
  content: string;
  fileName: string;
  contentType: string;
  size: number;
}

export class BackupGenerators {
  constructor(private supabase: SupabaseClient) {}

  async generateQuickBackup(userEmail: string): Promise<BackupResult> {
    const { data: quickBackup, error } = await this.supabase
      .rpc('generate_quick_backup');

    if (error) {
      console.error('Error generating quick backup:', error);
      throw error;
    }

    const content = JSON.stringify(quickBackup, null, 2);
    const fileName = `tms-gruas-quick-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    return {
      content,
      fileName,
      contentType: 'application/json',
      size: new Blob([content]).size
    };
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
        const { data, error } = await this.supabase
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
        backupData.data[table] = { error: e.message, count: 0 };
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
}
