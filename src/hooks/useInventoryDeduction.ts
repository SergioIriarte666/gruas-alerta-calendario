import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";


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

export const useInventoryDeduction = () => {
  const processInventoryDeduction = async ({ serviceId, serviceFolio, salesItems }: InventoryDeductionParams) => {
    if (!salesItems || salesItems.length === 0) {
      return { success: true, message: 'No hay productos para descontar del inventario' };
    }

    try {
      logger.debug(`🔄 Processing inventory deduction for service ${serviceFolio}...`);

      // Check if inventory has already been deducted for this service
      const { data: existingMovements, error: checkError } = await supabase
        .from('inventory_movements')
        .select('id')
        .eq('reference_document', serviceFolio)
        .eq('movement_type', 'sale');

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

        // Create inventory movement for the sale
        const { error: movementError } = await supabase
          .from('inventory_movements')
          .insert({
            item_id: item.productId,
            location_id: defaultLocationId,
            movement_type: 'sale',
            quantity: -Math.abs(item.quantity), // Negative for sales/exits
            movement_date: new Date().toISOString(),
            unit_cost: item.unitPrice,
            total_cost: item.quantity * item.unitPrice,
            reason: `Venta de producto - Servicio ${serviceFolio}`,
            reference_document: serviceFolio,
            observations: `Venta automática generada desde servicio de venta. Service ID: ${serviceId}`,
            status: 'active'
          });

        if (movementError) {
          throw new Error(`Error registrando movimiento de inventario para producto ${item.productId}: ${movementError.message}`);
        }

        // Update inventory stock directly
        // First, get current stock
        const { data: currentStock, error: getStockError } = await supabase
          .from('inventory_stock')
          .select('current_quantity')
          .eq('item_id', item.productId)
          .eq('location_id', defaultLocationId)
          .maybeSingle();

        if (getStockError) {
          logger.warn(`Warning getting current stock for ${item.productId}:`, getStockError);
          continue; // Skip this item and continue with others
        }

        const newQuantity = Math.max(0, (currentStock?.current_quantity || 0) - item.quantity);

        const { error: stockError } = await supabase
          .from('inventory_stock')
          .update({
            current_quantity: newQuantity,
            last_movement_date: new Date().toISOString()
          })
          .eq('item_id', item.productId)
          .eq('location_id', defaultLocationId);

        if (stockError) {
          logger.warn(`Warning updating stock for ${item.productId}:`, stockError);
          // Continue processing other items even if stock update fails
        }
      }

      logger.debug(`✅ Inventory deduction completed for service ${serviceFolio}`);
      
      return { 
        success: true, 
        message: `Se descontaron ${salesItems.length} productos del inventario automáticamente` 
      };

    } catch (error) {
      logger.error('❌ Error processing inventory deduction:', error);
      
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