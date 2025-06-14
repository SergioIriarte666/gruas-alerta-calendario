
import React, { useState, useCallback } from 'react';
import { CostsHeader } from '@/components/costs/CostsHeader';
import { CostsTable } from '@/components/costs/CostsTable';
import { CostForm } from '@/components/costs/CostForm';
import { useCosts } from '@/hooks/useCosts';
import { Cost } from '@/types/costs';
import { Skeleton } from '@/components/ui/skeleton';

const CostsPage = () => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedCost, setSelectedCost] = useState<Cost | null>(null);
    const { data: costs = [], isLoading } = useCosts();

    const handleOpenForm = useCallback((cost: Cost | null = null) => {
        setSelectedCost(cost);
        setIsFormOpen(true);
    }, []);

    const handleCloseForm = useCallback(() => {
        setSelectedCost(null);
        setIsFormOpen(false);
    }, []);

    return (
        <div className="space-y-6">
            <CostsHeader onAddCost={handleOpenForm} />
            {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : (
                <CostsTable costs={costs} onEdit={handleOpenForm} />
            )}
            <CostForm
                isOpen={isFormOpen}
                onClose={handleCloseForm}
                cost={selectedCost}
            />
        </div>
    );
};

export default CostsPage;
