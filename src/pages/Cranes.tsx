import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, Filter, Edit, Trash2, Power, AlertTriangle } from 'lucide-react';
import { useCranes } from '@/hooks/useCranes';
import { CraneForm } from '@/components/cranes/CraneForm';
import { Crane } from '@/types';

const Cranes = () => {
  const { cranes, loading, createCrane, updateCrane, deleteCrane, toggleCraneStatus } = useCranes();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCrane, setSelectedCrane] = useState<Crane | undefined>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filteredCranes = cranes.filter(crane =>
    crane.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    crane.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    crane.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateCrane = (craneData: Omit<Crane, 'id' | 'createdAt' | 'updatedAt'>) => {
    createCrane(craneData);
    setIsDialogOpen(false);
  };

  const handleUpdateCrane = (craneData: Omit<Crane, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (selectedCrane) {
      updateCrane(selectedCrane.id, craneData);
      setIsDialogOpen(false);
      setSelectedCrane(undefined);
    }
  };

  const handleEditCrane = (crane: Crane) => {
    setSelectedCrane(crane);
    setIsDialogOpen(true);
  };

  const handleDeleteCrane = (crane: Crane) => {
    if (window.confirm(`¿Estás seguro de eliminar la grúa "${crane.licensePlate}"?`)) {
      deleteCrane(crane.id);
    }
  };

  const handleToggleStatus = (crane: Crane) => {
    toggleCraneStatus(crane.id);
  };

  const handleNewCrane = () => {
    setSelectedCrane(undefined);
    setIsDialogOpen(true);
  };

  const getCraneTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      light: 'Liviana',
      medium: 'Mediana',
      heavy: 'Pesada',
      taxi: 'Taxi',
      other: 'Otros'
    };
    return types[type] || type;
  };

  const isExpiringSoon = (date: string) => {
    if (!date) return false;
    const expiryDate = new Date(date);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  };

  const isExpired = (date: string) => {
    if (!date) return false;
    const expiryDate = new Date(date);
    const today = new Date();
    return expiryDate < today;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Cargando grúas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Gestión de Grúas</h1>
          <p className="text-gray-400 mt-2">
            Administra la flota de grúas y sus documentos
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={handleNewCrane}
              className="bg-tms-green hover:bg-tms-green-dark text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Grúa
            </Button>
          </DialogTrigger>
          <CraneForm
            crane={selectedCrane}
            onSubmit={selectedCrane ? handleUpdateCrane : handleCreateCrane}
            onCancel={() => {
              setIsDialogOpen(false);
              setSelectedCrane(undefined);
            }}
          />
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por patente, marca o modelo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/5 border-gray-700 text-white placeholder-gray-400 focus:border-tms-green"
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

      {/* Cranes Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-white">
            Grúas Registradas ({filteredCranes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCranes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="w-16 h-16 bg-tms-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-tms-green" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                {searchTerm ? 'No se encontraron grúas' : 'No hay grúas registradas'}
              </h3>
              <p className="text-gray-400 mb-6">
                {searchTerm 
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Comienza agregando tu primera grúa'
                }
              </p>
              {!searchTerm && (
                <Button 
                  onClick={handleNewCrane}
                  className="bg-tms-green hover:bg-tms-green-dark text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Primera Grúa
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-300">Patente</TableHead>
                    <TableHead className="text-gray-300">Tipo</TableHead>
                    <TableHead className="text-gray-300">Marca/Modelo</TableHead>
                    <TableHead className="text-gray-300">Vencimientos</TableHead>
                    <TableHead className="text-gray-300">Estado</TableHead>
                    <TableHead className="text-gray-300">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCranes.map((crane) => (
                    <TableRow key={crane.id} className="border-gray-700 hover:bg-white/5">
                      <TableCell>
                        <div className="font-medium text-white">{crane.licensePlate}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-gray-600 text-gray-300">
                          {getCraneTypeLabel(crane.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-gray-300">
                          <div className="font-medium">{crane.brand}</div>
                          <div className="text-sm text-gray-400">{crane.model}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {[
                            { label: 'Permiso', date: crane.circulationPermitExpiry },
                            { label: 'Seguro', date: crane.insuranceExpiry },
                            { label: 'R. Técnica', date: crane.technicalReviewExpiry }
                          ].map(({ label, date }) => (
                            <div key={label} className="flex items-center space-x-2">
                              <span className="text-xs text-gray-400 w-16">{label}:</span>
                              {date ? (
                                <div className="flex items-center space-x-1">
                                  {(isExpired(date) || isExpiringSoon(date)) && (
                                    <AlertTriangle className={`w-3 h-3 ${isExpired(date) ? 'text-red-400' : 'text-yellow-400'}`} />
                                  )}
                                  <span className={`text-xs ${
                                    isExpired(date) ? 'text-red-400' : 
                                    isExpiringSoon(date) ? 'text-yellow-400' : 'text-gray-300'
                                  }`}>
                                    {new Date(date).toLocaleDateString()}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-500">No definido</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={crane.isActive ? "default" : "secondary"}
                          className={crane.isActive 
                            ? "bg-tms-green/20 text-tms-green border-tms-green/30" 
                            : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                          }
                        >
                          {crane.isActive ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCrane(crane)}
                            className="text-gray-400 hover:text-white"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(crane)}
                            className="text-gray-400 hover:text-white"
                          >
                            <Power className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCrane(crane)}
                            className="text-gray-400 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Cranes;
