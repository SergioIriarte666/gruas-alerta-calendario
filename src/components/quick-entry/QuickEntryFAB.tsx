import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuickEntryForm } from './QuickEntryForm';
import { useUserPermissions } from '@/hooks/useUserPermissions';

export function QuickEntryFAB() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { isAdmin, isLoading } = useUserPermissions();

  // Don't render while loading
  if (isLoading) return null;

  // Only show for admin users
  if (!isAdmin) return null;

  return (
    <>
      <Button
        onClick={() => setIsFormOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 z-[60] h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-2xl hover:shadow-xl transition-all duration-200 hover:scale-105 border-2 border-background"
      >
        <Plus className="h-8 w-8" />
      </Button>

      <QuickEntryForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
      />
    </>
  );
}