import { useQueryClient } from '@tanstack/react-query';
import { businessClock } from '@/utils/businessClock';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";
import { invalidateStockDependentQueries } from '@/lib/queryKeys/inventory';


const logger = createLogger("useInventoryDeduction");
interface ProductSaleItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

interface InventoryDeductionParams {
  serviceId: string;
  serviceFolio: string;
  salesItems: ProductSaleItem[];
}

// Costo FIFO simplificado: usa el costo unitario de la entrada activa más
// reciente para el producto/ubicación; si no hay entradas registradas, cae
// al costo de catálogo (inventory_items.unit_cost). No es un FIFO multi-capa
// completo, pero evita el bug anterior de usar el precio de venta como costo.
const resolveFifoUnitCost = async (itemId: string, locationId: string): Promise<number> => {
  const { data: lastEntry } = await supabase
    .from('inventory_movements')
    .select('unit_cost')
    .eq('item_id', itemId)
    .eq('location_id', locationId)
    .eq('movement_type', 'entry')
    .eq('status', 'active')
    .order('movement_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastEntry?.unit_cost != null) {
    return Number(lastEntry.unit_cost);
  }

  const { data: itemData } = await supabase
    .from('inventory_items')
    .select('unit_cost')
    .eq('id', itemId)
    .single();

  return Number(itemData?.unit_cost || 0);
};

export const useInventoryDeduction = () => {
  const queryClient = useQueryClient();

  const processInventoryDeduction = async ({ serviceId, serviceFolio, salesItems }: InventoryDeductionParams) => {
    if (!salesItems || salesItems.length === 0) {
      return { success: true, message: 'No hay productos para descontar del inventario' };
    }

    try {
      logger.debug(`🔄 Processing inventory exit for service ${serviceFolio}...`);

      // Idempotencia: si el servicio ya tiene salidas activas vinculadas, no duplicar
      const { data: existingMovements, error: checkError } = await supabase
        .from('inventory_movements')
        .select('id')
        .eq('service_id', serviceId)
        .eq('movement_type', 'exit')
        .eq('status', 'active');

      if (checkError) throw checkError;

      if (existingMovements && existingMovements.length > 0) {
        logger.debug(`⚠️ Inventory already deducted for service ${serviceFolio}`);
        return {
          success: true,
          message: 'El inventario ya fue descontado para este servicio'
        };
      }

      // Get default location (first available location)
      const { data: locations, error: locationsError } = await supabase
        .from('inventory_locations')
        .select('id')
        .eq('is_active', true)
        .limit(1);

      if (locationsError) throw locationsError;

      if (!locations || locations.length === 0) {
        throw new Error('No hay ubicaciones de inventario disponibles');
      }

      const defaultLocationId = locations[0].id;

      // Process each sales item
      for (const item of salesItems) {
        logger.debug(`📦 Processing product sale: ${item.productId}, quantity: ${item.quantity}`);

        const { data: stockData, error: stockCheckError } = await supabase
          .from('inventory_stock')
          .select('available_quantity')
          .eq('item_id', item.productId)
          .eq('location_id', defaultLocationId)
          .maybeSingle();

        if (stockCheckError) throw stockCheckError;

        if (!stockData || stockData.available_quantity < item.quantity) {
          throw new Error(
            `Stock insuficiente para el producto vendido. Disponible: ${stockData?.available_quantity ?? 0}, Solicitado: ${item.quantity}`
          );
        }

        const fifoUnitCost = await resolveFifoUnitCost(item.productId, defaultLocationId);

        // Salida de bodega vinculada al servicio de venta. No se setea crane_id
        // a propósito: sync_inventory_exit_to_crane_parts_trigger solo actúa
        // cuando crane_id no es nulo, así que esta salida no genera crane_parts
        // ni costo operacional — el ingreso ya se registra en services.value.
        const { error: movementError } = await supabase
          .from('inventory_movements')
          .insert({
            item_id: item.productId,
            location_id: defaultLocationId,
            movement_type: 'exit',
            quantity: Math.abs(item.quantity),
            movement_date: businessClock.nowISO(),
            unit_cost: fifoUnitCost,
            total_cost: fifoUnitCost * item.quantity,
            sale_unit_price: item.unitPrice,
            service_id: serviceId,
            reason: 'Venta a cliente',
            reference_document: serviceFolio,
            observations: `Venta a cliente - Servicio ${serviceFolio}`,
            status: 'active'
          });

        if (movementError) {
          throw new Error(`Error registrando salida de inventario para producto ${item.productId}: ${movementError.message}`);
        }
      }

      logger.debug(`✅ Inventory exit completed for service ${serviceFolio}`);

      // La venta acaba de mover stock: Bodega y el selector de productos deben
      // mostrar el número nuevo sin recargar la página.
      invalidateStockDependentQueries(queryClient);

      return {
        success: true,
        message: `Se descontaron ${salesItems.length} productos del inventario automáticamente`
      };

    } catch (error) {
      logger.error('❌ Error processing inventory exit:', error);

      // Don't throw error to avoid blocking service creation/completion
      // Just log and show warning
      toast.error(`Advertencia: Error al descontar inventario - ${error.message}`);

      return {
        success: false,
        error: error.message,
        message: 'Servicio creado pero hubo errores al descontar del inventario'
      };
    }
  };

  return {
    processInventoryDeduction
  };
};
