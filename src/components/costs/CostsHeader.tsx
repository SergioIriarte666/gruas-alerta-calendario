
import React from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

interface CostsHeaderProps {
    onAddCost: () => void;
}

export const CostsHeader = ({ onAddCost }: CostsHeaderProps) => {
    return (
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold text-white">Gestión de Costos</h1>
                <p className="text-gray-300 mt-1">Registra y analiza los costos operativos del negocio.</p>
            </div>
            <Button onClick={onAddCost} className="bg-tms-green hover:bg-tms-green/90">
                <PlusCircle className="w-4 h-4 mr-2" />
                Registrar Costo
            </Button>
        </div>
    );
};
