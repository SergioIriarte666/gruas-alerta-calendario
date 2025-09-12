import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export const ThemeToggle = ({ size = 'default', className }: ThemeToggleProps) => {
  const { theme, setTheme } = useTheme();

  const getIcon = () => {
    switch (theme) {
      case 'dark':
        return <Moon className={cn(size === 'sm' ? 'w-4 h-4' : 'w-5 h-5')} />;
      case 'system':
        return <Monitor className={cn(size === 'sm' ? 'w-4 h-4' : 'w-5 h-5')} />;
      default:
        return <Sun className={cn(size === 'sm' ? 'w-4 h-4' : 'w-5 h-5')} />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={size === 'sm' ? 'sm' : 'icon'}
          className={cn(
            'text-foreground hover:bg-primary hover:text-primary-foreground transition-colors',
            className
          )}
        >
          {getIcon()}
          <span className="sr-only">Cambiar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover border tms-shadow-lg">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className={cn(
            'cursor-pointer text-foreground hover:bg-primary hover:text-primary-foreground',
            theme === 'light' && 'bg-accent'
          )}
        >
          <Sun className="w-4 h-4 mr-2" />
          Claro
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className={cn(
            'cursor-pointer text-foreground hover:bg-primary hover:text-primary-foreground',
            theme === 'dark' && 'bg-accent'
          )}
        >
          <Moon className="w-4 h-4 mr-2" />
          Oscuro
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className={cn(
            'cursor-pointer text-foreground hover:bg-primary hover:text-primary-foreground',
            theme === 'system' && 'bg-accent'
          )}
        >
          <Monitor className="w-4 h-4 mr-2" />
          Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};