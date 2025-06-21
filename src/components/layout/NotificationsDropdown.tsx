
import React from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const NotificationsDropdown = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-white hover:text-black hover:bg-tms-green relative bg-tms-green/20 border border-tms-green/30"
        >
          <Bell className="w-5 h-5 text-tms-green" />
          {/* Badge de notificaciones pendientes */}
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full text-xs flex items-center justify-center">
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="bg-black border-tms-green/30 min-w-[200px] z-50"
      >
        <div className="p-4 text-center text-gray-400">
          No hay notificaciones
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
