
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
        <div className="space-y-2 p-4 rounded-lg border bg-white border-gray-200" style={{ background: '#ffffff' }}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-black">{progress.stage}</span>
            <span className="text-gray-600">{progress.progress}%</span>
          </div>
          <Progress value={progress.progress} className="w-full h-2" />
        </div>
      )}

      {progress.error && (
        <Alert 
          className="border-red-200" 
          style={{ background: '#ffffff', color: '#000000', borderColor: '#fecaca' }}
        >
          <XCircle className="w-4 h-4 text-red-500" />
          <AlertDescription className="text-red-700" style={{ color: '#b91c1c' }}>
            Error: {progress.error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
