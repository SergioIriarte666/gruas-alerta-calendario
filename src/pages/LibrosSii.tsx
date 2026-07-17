import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SiiRcvImportCard } from '@/components/siircv/SiiRcvImportCard';
import { SiiRcvTable } from '@/components/siircv/SiiRcvTable';
import { SiiResultadoPanel } from '@/components/siircv/SiiResultadoPanel';
import { LowboyIvaPanel } from '@/components/siircv/LowboyIvaPanel';
import { LowboySalesPanel } from '@/components/siircv/LowboySalesPanel';
import { LowboyContainersPanel } from '@/components/siircv/LowboyContainersPanel';
import { useUser } from '@/contexts/UserContext';
import { Ship } from 'lucide-react';

const DEFAULT_ENTITY_RUT = '78.387.656-6';

const LibrosSii = () => {
  const [entityRut, setEntityRut] = useState(DEFAULT_ENTITY_RUT);
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="lowboy-concept animate-in fade-in duration-500 space-y-6 pb-6">
      <div className="flex flex-col gap-2">
        <span className="dashboard-section-kicker"><Ship className="size-3.5" />Unidad de negocio</span>
        <h1 className="dashboard-section-title">Lowboy</h1>
        <p className="dashboard-section-description">Registro de Compras y Ventas conciliado con costos y servicios.</p>
      </div>

      <Tabs defaultValue="ventas" className="space-y-4">
        <TabsList className="finance-tabs grid h-auto w-full grid-cols-2 gap-1 p-1 sm:inline-grid sm:w-auto sm:grid-cols-4">
          <TabsTrigger value="ventas">
            Ventas
          </TabsTrigger>
          <TabsTrigger value="import">
            Importar / Registros
          </TabsTrigger>
          <TabsTrigger value="containers">
            Contenedores
          </TabsTrigger>
          <TabsTrigger value="resultado">
            Resultado
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-4">
          {isAdmin && <SiiRcvImportCard entityRut={entityRut} onEntityRutChange={setEntityRut} />}
          <SiiRcvTable entityRut={entityRut.trim()} />
        </TabsContent>

        <TabsContent value="ventas" className="space-y-4">
          <LowboySalesPanel />
        </TabsContent>

        <TabsContent value="containers" className="space-y-4">
          <LowboyContainersPanel />
        </TabsContent>

        <TabsContent value="resultado" className="space-y-4">
          <Tabs defaultValue="iva" className="space-y-4">
            <TabsList className="finance-tabs p-1">
              <TabsTrigger value="iva">
                IVA (F29)
              </TabsTrigger>
              <TabsTrigger value="margen">
                Margen / Costos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="iva" className="space-y-4">
              <LowboyIvaPanel entityRut={entityRut} />
            </TabsContent>

            <TabsContent value="margen" className="space-y-4">
              <SiiResultadoPanel entityRut={entityRut} />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LibrosSii;
