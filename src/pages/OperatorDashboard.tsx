
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Truck } from 'lucide-react';

const OperatorDashboard = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex justify-between items-center pb-4 border-b border-slate-700">
        <div>
          <h1 className="text-2xl font-bold text-tms-green">Portal del Operador</h1>
          <p className="text-gray-400">Bienvenido, {user?.email}</p>
        </div>
        <Button onClick={signOut} variant="ghost" className="text-gray-300 hover:bg-slate-700 hover:text-white">
          <LogOut className="w-4 h-4 mr-2" />
          Cerrar Sesión
        </Button>
      </header>
      
      <div className="text-center bg-slate-800 p-8 rounded-lg border border-slate-700">
        <Truck className="w-16 h-16 mx-auto mb-4 text-tms-green opacity-50" />
        <h2 className="text-xl font-semibold mb-2 text-white">No hay servicios asignados</h2>
        <p className="text-gray-400 max-w-md mx-auto">
          En este momento, no tienes ningún servicio de grúa en curso. Cuando se te asigne uno, aparecerá aquí con todos los detalles necesarios.
        </p>
      </div>

      <footer className="text-center text-gray-500 text-sm pt-4">
        <p>TMS Grúas &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
};

export default OperatorDashboard;
