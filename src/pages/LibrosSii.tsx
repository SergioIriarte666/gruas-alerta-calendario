import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SiiRcvImportCard } from '@/components/siircv/SiiRcvImportCard';
import { SiiRcvTable } from '@/components/siircv/SiiRcvTable';
import { SiiResultadoPanel } from '@/components/siircv/SiiResultadoPanel';
import { LowboyIvaPanel } from '@/components/siircv/LowboyIvaPanel';
import { LowboySalesPanel } from '@/components/siircv/LowboySalesPanel';
import { useUser } from '@/contexts/UserContext';

const DEFAULT_ENTITY_RUT = '78.387.656-6';

const LibrosSii = () => {
  const [entityRut, setEntityRut] = useState(DEFAULT_ENTITY_RUT);
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold tracking-tight sm:text-3xl">Lowboy</h1>
        <p className="text-muted-foreground">
          Registro de Compras y Ventas (RCV), conciliado con costos y servicios del TMS.
        </p>
      </div>

      <Tabs defaultValue="ventas" className="space-y-4">
        <TabsList className="bg-muted/30 p-1">
          <TabsTrigger value="ventas" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
            Ventas
          </TabsTrigger>
          <TabsTrigger value="import" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
            Importar / Registros
          </TabsTrigger>
          <TabsTrigger value="resultado" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
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

        <TabsContent value="resultado" className="space-y-4">
          <Tabs defaultValue="iva" className="space-y-4">
            <TabsList className="bg-muted/30 p-1">
              <TabsTrigger value="iva" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                IVA (F29)
              </TabsTrigger>
              <TabsTrigger value="margen" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
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
