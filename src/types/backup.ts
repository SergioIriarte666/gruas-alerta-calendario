
export interface BackupLog {
  id: string;
  created_at: string;
  created_by: string;
  backup_type: 'full' | 'quick' | 'auto';
  status: 'started' | 'completed' | 'failed';
  file_size_bytes?: number;
  error_message?: string;
  metadata?: {
    fileName?: string;
    contentType?: string;
    records_count?: string | number;
  };
}

export interface BackupProgress {
  isGenerating: boolean;
  progress: number;
  stage: string;
  error?: string;
}

export interface BackupResult {
  success: boolean;
  fileName?: string;
  content?: string;
  size?: number;
  type?: string;
  error?: string;
}

export interface BackupSettings {
  autoBackupEnabled: boolean;
  lastAutoBackup?: string;
  backupRetentionDays: number;
}
