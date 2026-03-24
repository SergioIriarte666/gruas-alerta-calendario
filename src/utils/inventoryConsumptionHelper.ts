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
        movement_type: 'entry',
        quantity: quantity,
        unit_cost: unitCost,
        total_cost: quantity * unitCost,
        movement_date: date,
        reason: 'Compra con consumo inmediato',
        observations: `Compra registrada desde costo ID: ${costId}`,
        status: 'active',
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
        movement_type: 'exit',
        quantity: quantity,
        unit_cost: unitCost,
        total_cost: quantity * unitCost,
        movement_date: date,
        reason: 'Consumo inmediato',
        observations: `Consumo directo a grúa desde costo ID: ${costId}`,
        status: 'active',
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

interface CreateDirectEntryData {
  costId: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  date: string;
  supplierId?: string | null;
}

/**
 * Creates an inventory ENTRY movement only (no exit/consumption).
 * Used by XML importers when "Sync with Inventory" is enabled,
 * since no destination crane is selected during XML import.
 */
export const createDirectInventoryEntry = async ({
  costId,
  itemName,
  quantity,
  unitCost,
  date,
  supplierId,
}: CreateDirectEntryData): Promise<boolean> => {
  try {
    console.log('[InventoryEntry] Starting entry for cost:', costId);

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
    } else {
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
        console.error('[InventoryEntry] Error creating item:', createItemError);
        throw new Error('No se pudo crear el ítem de inventario');
      }
      inventoryItemId = newItem.id;
    }

    // 2. Get active warehouse location
    const { data: location } = await supabase
      .from('inventory_locations')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!location) {
      throw new Error('No hay ubicación de inventario activa');
    }

    // 3. Create ENTRY movement only
    const { data: entryMovement, error: entryError } = await supabase
      .from('inventory_movements')
      .insert({
        item_id: inventoryItemId,
        location_id: location.id,
        movement_type: 'entry',
        quantity,
        unit_cost: unitCost,
        total_cost: quantity * unitCost,
        movement_date: date,
        reason: 'Compra desde importación XML',
        observations: `Entrada registrada desde costo ID: ${costId}`,
        status: 'active',
        cost_id: costId,
        supplier_id: supplierId || null,
      })
      .select('id')
      .single();

    if (entryError || !entryMovement) {
      console.error('[InventoryEntry] Error creating entry:', entryError);
      throw new Error('No se pudo crear el movimiento de entrada');
    }

    // 4. Link cost to movement
    await supabase
      .from('costs')
      .update({ inventory_movement_id: entryMovement.id })
      .eq('id', costId);

    console.log('[InventoryEntry] Entry created:', entryMovement.id);
    return true;
  } catch (error) {
    console.error('[InventoryEntry] Error:', error);
    return false;
  }
};

/**
 * Syncs costs with immediate_consumption=true that don't have inventory movements.
 * This is used to retroactively fix records created before the fix was applied.
 */
export const syncUnsyncedImmediateConsumptions = async (): Promise<{
  synced: number;
  errors: number;
}> => {
  console.log('[InventorySync] Starting retroactive sync...');
  
  let synced = 0;
  let errors = 0;
  
  try {
    // Find costs with immediate_consumption that have crane_id but no inventory movements
    const { data: unsyncedCosts, error: queryError } = await supabase
      .from('costs')
      .select('id, description, purchase_quantity, purchase_unit_cost, crane_id, date, supplier_id')
      .eq('immediate_consumption', true)
      .not('crane_id', 'is', null)
      .not('purchase_quantity', 'is', null)
      .not('purchase_unit_cost', 'is', null);
    
    if (queryError) {
      console.error('[InventorySync] Error querying unsynced costs:', queryError);
      throw queryError;
    }
    
    if (!unsyncedCosts?.length) {
      console.log('[InventorySync] No costs with immediate consumption found');
      return { synced: 0, errors: 0 };
    }
    
    console.log('[InventorySync] Found', unsyncedCosts.length, 'costs with immediate consumption');
    
    // Check each cost to see if it already has movements
    for (const cost of unsyncedCosts) {
      const { data: existingMovements } = await supabase
        .from('inventory_movements')
        .select('id')
        .eq('cost_id', cost.id)
        .limit(1);
      
      if (existingMovements && existingMovements.length > 0) {
        console.log('[InventorySync] Cost', cost.id, 'already has movements, skipping');
        continue;
      }
      
      console.log('[InventorySync] Syncing cost:', cost.id, '-', cost.description);
      
      try {
        const success = await createDirectInventoryConsumption({
          costId: cost.id,
          itemName: cost.description,
          quantity: cost.purchase_quantity!,
          unitCost: cost.purchase_unit_cost!,
          craneId: cost.crane_id!,
          date: cost.date,
          supplierId: cost.supplier_id,
        });
        
        if (success) {
          synced++;
          console.log('[InventorySync] Successfully synced cost:', cost.id);
        } else {
          errors++;
        }
      } catch (err) {
        console.error('[InventorySync] Error syncing cost:', cost.id, err);
        errors++;
      }
    }
    
    console.log('[InventorySync] Sync completed. Synced:', synced, 'Errors:', errors);
    
    if (synced > 0) {
      toast.success('Sincronización Completada', {
        description: `Se sincronizaron ${synced} costo(s) con inventario`,
      });
    }
    
    return { synced, errors };
  } catch (error) {
    console.error('[InventorySync] Fatal error during sync:', error);
    toast.error('Error en Sincronización', {
      description: 'No se pudo completar la sincronización retroactiva',
    });
    return { synced, errors: errors + 1 };
  }
};
