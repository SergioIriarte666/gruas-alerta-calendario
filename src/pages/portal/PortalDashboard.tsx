import React from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';

const PortalDashboard: React.FC = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Mi Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-white">Servicios Recientes</h2>
          <p className="text-gray-400 mt-2">Aquí se mostrará una lista de sus servicios más recientes.</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-white">Facturas Pendientes</h2>
          <p className="text-gray-400 mt-2">Aquí verá las facturas que tiene pendientes de pago.</p>
        </div>
        <Link 
          to="/portal/request-service"
          className="bg-tms-green/20 border border-tms-green text-white p-6 rounded-lg shadow-lg flex flex-col items-center justify-center hover:bg-tms-green/30 transition-colors"
        >
          <PlusCircle className="w-12 h-12 text-tms-green mb-4" />
          <h2 className="text-xl font-semibold text-white">Solicitar Nuevo Servicio</h2>
          <p className="text-gray-300 mt-2 text-center">Acceso rápido para crear una nueva solicitud de grúa.</p>
        </Link>
      </div>
    </div>
  );
};

export default PortalDashboard;
