import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateDirectConsumptionData {
  costId: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  craneId: string;
  date: string;
  supplierId?: string | null;
}

/**
 * Creates inventory movements for direct consumption when a cost is registered
 * with immediate_consumption=true and a specific crane is selected.
 * 
 * Flow:
 * 1. Find or create the inventory item
 * 2. Get an active warehouse location
 * 3. Create ENTRY movement (purchase into warehouse)
 * 4. Create EXIT movement (consumption to the crane)
 * 5. Link the cost to the inventory movement
 */
export const createDirectInventoryConsumption = async ({
  costId,
  itemName,
  quantity,
  unitCost,
  craneId,
  date,
  supplierId,
}: CreateDirectConsumptionData): Promise<boolean> => {
  try {
    console.log('[InventoryConsumption] Starting direct consumption for cost:', costId);
    
    // 1. Find or create inventory item
    let inventoryItemId: string;
    
    const { data: existingItem } = await supabase
      .from('inventory_items')
      .select('id')
      .ilike('name', itemName.trim())
      .limit(1)
      .single();
    
    if (existingItem) {
      inventoryItemId = existingItem.id;
      console.log('[InventoryConsumption] Found existing item:', inventoryItemId);
    } else {
      // Create new inventory item
      const { data: newItem, error: createItemError } = await supabase
        .from('inventory_items')
        .insert({
          name: itemName.trim(),
          unit_of_measure: 'unidad',
          unit_cost: unitCost,
          is_active: true,
        })
        .select('id')
        .single();
      
      if (createItemError || !newItem) {
        console.error('[InventoryConsumption] Error creating item:', createItemError);
        throw new Error('No se pudo crear el ítem de inventario');
      }
      
      inventoryItemId = newItem.id;
      console.log('[InventoryConsumption] Created new item:', inventoryItemId);
    }
    
    // 2. Get active warehouse location
    const { data: location } = await supabase
      .from('inventory_locations')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();
    
    if (!location) {
      console.error('[InventoryConsumption] No active location found');
      throw new Error('No hay ubicación de inventario activa');
    }
    
    const locationId = location.id;
    console.log('[InventoryConsumption] Using location:', locationId);
    
    // 3. Create ENTRY movement (purchase)
    const { data: entryMovement, error: entryError } = await supabase
      .from('inventory_movements')
      .insert({
        item_id: inventoryItemId,
        location_id: locationId,
        movement_type: 'entrada',
        quantity: quantity,
        unit_cost: unitCost,
        total_cost: quantity * unitCost,
        movement_date: date,
        reason: 'Compra con consumo inmediato',
        observations: `Compra registrada desde costo ID: ${costId}`,
        status: 'completed',
        cost_id: costId,
        supplier_id: supplierId || null,
      })
      .select('id')
      .single();
    
    if (entryError || !entryMovement) {
      console.error('[InventoryConsumption] Error creating entry movement:', entryError);
      throw new Error('No se pudo crear el movimiento de entrada');
    }
    
    console.log('[InventoryConsumption] Created entry movement:', entryMovement.id);
    
    // 4. Create EXIT movement (consumption to crane)
    const { data: exitMovement, error: exitError } = await supabase
      .from('inventory_movements')
      .insert({
        item_id: inventoryItemId,
        location_id: locationId,
        movement_type: 'salida',
        quantity: quantity,
        unit_cost: unitCost,
        total_cost: quantity * unitCost,
        movement_date: date,
        reason: 'Consumo inmediato',
        observations: `Consumo directo a grúa desde costo ID: ${costId}`,
        status: 'completed',
        crane_id: craneId,
        cost_id: costId,
      })
      .select('id')
      .single();
    
    if (exitError || !exitMovement) {
      console.error('[InventoryConsumption] Error creating exit movement:', exitError);
      throw new Error('No se pudo crear el movimiento de salida');
    }
    
    console.log('[InventoryConsumption] Created exit movement:', exitMovement.id);
    
    // 5. Update cost with inventory_movement_id (link to exit movement)
    const { error: updateCostError } = await supabase
      .from('costs')
      .update({ inventory_movement_id: exitMovement.id })
      .eq('id', costId);
    
    if (updateCostError) {
      console.error('[InventoryConsumption] Error linking cost to movement:', updateCostError);
      // Non-fatal, movements are already created
    }
    
    console.log('[InventoryConsumption] Successfully completed direct consumption');
    toast.success('Inventario Actualizado', {
      description: `Se registró entrada y consumo de ${quantity} unidad(es) de "${itemName}"`,
    });
    
    return true;
  } catch (error) {
    console.error('[InventoryConsumption] Error in createDirectInventoryConsumption:', error);
    toast.error('Error de Inventario', {
      description: error instanceof Error ? error.message : 'No se pudieron crear los movimientos de inventario',
    });
    return false;
  }
};
