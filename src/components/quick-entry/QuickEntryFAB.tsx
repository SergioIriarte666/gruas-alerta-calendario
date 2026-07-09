import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuickEntryForm } from './QuickEntryForm';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useDraggableFab } from '@/hooks/useDraggableFab';

const FAB_SIZE = 64; // size-16
const SNAP_TO_EDGE = true;

export function QuickEntryFAB() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { isAdmin, isLoading } = useUserPermissions();

  const { style, handlers } = useDraggableFab({
    storageKey: 'fab-registros-rapidos-pos',
    onActivate: () => setIsFormOpen(true),
    size: FAB_SIZE,
    snapToEdge: SNAP_TO_EDGE,
  });

  // Don't render while loading
  if (isLoading) return null;

  // Only show for admin users
  if (!isAdmin) return null;

  return (
    <>
      <Button
        {...handlers}
        style={style}
        aria-label="Registros Rápidos"
        size="icon"
        className="z-[60] size-16 rounded-full bg-primary text-primary-foreground shadow-2xl hover:shadow-xl transition-shadow duration-200 border-2 border-background select-none"
      >
        <Plus className="size-8" />
      </Button>

      <QuickEntryForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
      />
    </>
  );
}