
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Calendar = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Calendario Centralizado</h1>
          <p className="text-gray-400 mt-2">
            Vista integrada de servicios, vencimientos y eventos importantes
          </p>
        </div>
      </div>

      {/* Calendar Controls */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" className="border-gray-700 text-gray-300">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-xl font-semibold text-white">Junio 2024</h2>
              <Button variant="outline" size="sm" className="border-gray-700 text-gray-300">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" className="border-gray-700 text-gray-300">
                Día
              </Button>
              <Button variant="outline" size="sm" className="border-gray-700 text-gray-300">
                Semana
              </Button>
              <Button size="sm" className="bg-tms-green hover:bg-tms-green-dark text-white">
                Mes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
            <CalendarIcon className="w-5 h-5 text-tms-green" />
            <span>Vista Mensual</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-400">
            <div className="w-16 h-16 bg-tms-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarIcon className="w-8 h-8 text-tms-green" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              Calendario en Desarrollo
            </h3>
            <p className="text-gray-400">
              El componente de calendario centralizado estará disponible próximamente
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Calendar;
