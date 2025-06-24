
import React from 'react';
import { Outlet } from 'react-router-dom';
import { User, Truck } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';

export const OperatorLayout = () => {
  const { user } = useUser();

  return (
    <div className="min-h-screen bg-gradient-tms">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-lg border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-tms-green rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">TMS Grúas</h1>
              <p className="text-xs text-gray-400">Panel del Operador</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-white">
              <User className="w-4 h-4" />
              <span className="text-sm">{user?.name}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
};
