
import React from 'react';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';

interface CostFormActionsProps {
    onClose: () => void;
    isSubmitting: boolean;
}

export const CostFormActions = ({ onClose, isSubmitting }: CostFormActionsProps) => {
    return (
        <DialogFooter>
            <Button type="button" variant="outline" className="text-foreground hover:bg-muted/70" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar Costo'}
            </Button>
        </DialogFooter>
    );
};
