
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { XCircle } from 'lucide-react';
import type { BackupProgress } from '@/types/backup';

interface BackupProgressDisplayProps {
  progress: BackupProgress;
}

export const BackupProgressDisplay: React.FC<BackupProgressDisplayProps> = ({ progress }) => {
  if (!progress.isGenerating && !progress.error) {
    return null;
  }

  return (
    <div className="space-y-2">
      {progress.isGenerating && (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground">{progress.stage}</span>
            <span className="text-muted-foreground">{progress.progress}%</span>
          </div>
          <Progress value={progress.progress} className="w-full h-2" />
        </div>
      )}

      {progress.error && (
        <Alert variant="destructive">
          <XCircle className="size-4 text-danger" />
          <AlertDescription className="text-foreground">
            Error: {progress.error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
