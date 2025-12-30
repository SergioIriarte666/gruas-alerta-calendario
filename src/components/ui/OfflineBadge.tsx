/**
 * Badge visual para indicar registros sin sincronizar
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CloudOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineBadgeProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md';
  syncing?: boolean;
}

export const OfflineBadge: React.FC<OfflineBadgeProps> = ({ 
  className,
  showText = true,
  size = 'sm',
  syncing = false
}) => {
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        'bg-amber-500/10 text-amber-500 border-amber-500/30',
        size === 'sm' ? 'text-xs py-0 px-1.5' : 'text-sm py-0.5 px-2',
        className
      )}
    >
      {syncing ? (
        <RefreshCw className={cn(iconSize, 'animate-spin', showText && 'mr-1')} />
      ) : (
        <CloudOff className={cn(iconSize, showText && 'mr-1')} />
      )}
      {showText && (syncing ? 'Sincronizando...' : 'Sin sincronizar')}
    </Badge>
  );
};

/**
 * Verifica si un registro tiene marca de offline
 */
export function isOfflineRecord(record: any): boolean {
  return record?._isOffline === true;
}

/**
 * Verifica si un ID es temporal (creado offline)
 */
export function isTempId(id: string): boolean {
  return id?.startsWith('temp_');
}
