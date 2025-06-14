
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter } from 'lucide-react';

const Services = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Gestión de Servicios</h1>
          <p className="text-gray-400 mt-2">
            Administra todos los servicios de grúa del sistema
          </p>
        </div>
        <Button className="bg-tms-green hover:bg-tms-green-dark text-white">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Servicio
        </Button>
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por folio, cliente, patente..."
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-tms-green focus:outline-none"
                />
              </div>
            </div>
            <Button variant="outline" className="border-gray-700 text-gray-300 hover:text-white">
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Services Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-white">Servicios Registrados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-400">
            <div className="w-16 h-16 bg-tms-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-tms-green" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              No hay servicios registrados
            </h3>
            <p className="text-gray-400 mb-6">
              Comienza agregando tu primer servicio de grúa
            </p>
            <Button className="bg-tms-green hover:bg-tms-green-dark text-white">
              <Plus className="w-4 h-4 mr-2" />
              Crear Primer Servicio
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Services;
