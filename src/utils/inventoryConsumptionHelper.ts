import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import { EntityKey, resolveInventoryLocationId } from '@/lib/entities';

const logger = createLogger('InventoryConsumptionHelper');

interface CreateDirectConsumptionData {
  costId: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  craneId: string;
  date: string;
  supplierId?: string | null;
  entity?: EntityKey;
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
  entity,
}: CreateDirectConsumptionData): Promise<boolean> => {
  try {
    logger.debug('[InventoryConsumption] Starting direct consumption for cost:', costId);

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
      logger.debug('[InventoryConsumption] Found existing item:', inventoryItemId);
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
        logger.error('[InventoryConsumption] Error creating item:', createItemError);
        throw new Error('No se pudo crear el ítem de inventario');
      }

      inventoryItemId = newItem.id;
      logger.debug('[InventoryConsumption] Created new item:', inventoryItemId);
    }

    // 2. Get warehouse location for this entity (G5N y LowBoy tienen bodegas separadas)
    const locationId = await resolveInventoryLocationId(supabase, entity);
    logger.debug('[InventoryConsumption] Using location:', locationId);
    
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
      logger.error('[InventoryConsumption] Error creating entry movement:', entryError);
      throw new Error('No se pudo crear el movimiento de entrada');
    }
    
    logger.debug('[InventoryConsumption] Created entry movement:', entryMovement.id);
    
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
      logger.error('[InventoryConsumption] Error creating exit movement:', exitError);
      throw new Error('No se pudo crear el movimiento de salida');
    }
    
    logger.debug('[InventoryConsumption] Created exit movement:', exitMovement.id);
    
    // 5. Update cost with inventory_movement_id (link to exit movement)
    const { error: updateCostError } = await supabase
      .from('costs')
      .update({ inventory_movement_id: exitMovement.id })
      .eq('id', costId);
    
    if (updateCostError) {
      logger.error('[InventoryConsumption] Error linking cost to movement:', updateCostError);
      // Non-fatal, movements are already created
    }
    
    logger.debug('[InventoryConsumption] Successfully completed direct consumption');
    toast.success('Inventario Actualizado', {
      description: `Se registró entrada y consumo de ${quantity} unidad(es) de "${itemName}"`,
    });
    
    return true;
  } catch (error) {
    logger.error('[InventoryConsumption] Error in createDirectInventoryConsumption:', error);
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
  entity?: EntityKey;
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
  entity,
}: CreateDirectEntryData): Promise<boolean> => {
  try {
    logger.debug('[InventoryEntry] Starting entry for cost:', costId);

    const { data: existingEntry } = await supabase
      .from('inventory_movements')
      .select('id')
      .eq('cost_id', costId)
      .eq('movement_type', 'entry')
      .eq('status', 'active')
      .limit(1)
      .single();

    if (existingEntry?.id) {
      await supabase
        .from('costs')
        .update({ inventory_movement_id: existingEntry.id })
        .eq('id', costId);
      return true;
    }

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
        logger.error('[InventoryEntry] Error creating item:', createItemError);
        throw new Error('No se pudo crear el ítem de inventario');
      }
      inventoryItemId = newItem.id;
    }

    // 2. Get warehouse location for this entity (G5N y LowBoy tienen bodegas separadas)
    const locationId = await resolveInventoryLocationId(supabase, entity);

    // 3. Create ENTRY movement only
    const { data: entryMovement, error: entryError } = await supabase
      .from('inventory_movements')
      .insert({
        item_id: inventoryItemId,
        location_id: locationId,
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
      const supabaseError = entryError as any;
      if (
        supabaseError?.code === '23505' &&
        typeof supabaseError?.message === 'string' &&
        supabaseError.message.includes('uniq_inventory_entry_active_per_cost')
      ) {
        const { data: alreadyCreated } = await supabase
          .from('inventory_movements')
          .select('id')
          .eq('cost_id', costId)
          .eq('movement_type', 'entry')
          .eq('status', 'active')
          .limit(1)
          .single();

        if (alreadyCreated?.id) {
          await supabase
            .from('costs')
            .update({ inventory_movement_id: alreadyCreated.id })
            .eq('id', costId);
          return true;
        }
      }

      logger.error('[InventoryEntry] Error creating entry:', entryError);
      throw new Error('No se pudo crear el movimiento de entrada');
    }

    // 4. Link cost to movement
    await supabase
      .from('costs')
      .update({ inventory_movement_id: entryMovement.id })
      .eq('id', costId);

    logger.debug('[InventoryEntry] Entry created:', entryMovement.id);
    return true;
  } catch (error) {
    logger.error('[InventoryEntry] Error:', error);
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
  logger.debug('[InventorySync] Starting retroactive sync...');
  
  let synced = 0;
  let errors = 0;
  
  try {
    // Find costs with immediate_consumption that have crane_id but no inventory movements
    const { data: unsyncedCosts, error: queryError } = await supabase
      .from('costs')
      .select('id, description, purchase_quantity, purchase_unit_cost, crane_id, date, supplier_id, entity')
      .eq('immediate_consumption', true)
      .not('crane_id', 'is', null)
      .not('purchase_quantity', 'is', null)
      .not('purchase_unit_cost', 'is', null);
    
    if (queryError) {
      logger.error('[InventorySync] Error querying unsynced costs:', queryError);
      throw queryError;
    }
    
    if (!unsyncedCosts?.length) {
      logger.debug('[InventorySync] No costs with immediate consumption found');
      return { synced: 0, errors: 0 };
    }
    
    logger.debug('[InventorySync] Found', unsyncedCosts.length, 'costs with immediate consumption');
    
    // Check each cost to see if it already has movements
    for (const cost of unsyncedCosts) {
      const { data: existingMovements } = await supabase
        .from('inventory_movements')
        .select('id')
        .eq('cost_id', cost.id)
        .limit(1);
      
      if (existingMovements && existingMovements.length > 0) {
        logger.debug('[InventorySync] Cost', cost.id, 'already has movements, skipping');
        continue;
      }
      
      logger.debug('[InventorySync] Syncing cost:', cost.id, '-', cost.description);
      
      try {
        const success = await createDirectInventoryConsumption({
          costId: cost.id,
          itemName: cost.description,
          quantity: cost.purchase_quantity!,
          unitCost: cost.purchase_unit_cost!,
          craneId: cost.crane_id!,
          date: cost.date,
          supplierId: cost.supplier_id,
          entity: (cost as { entity?: EntityKey }).entity,
        });
        
        if (success) {
          synced++;
          logger.debug('[InventorySync] Successfully synced cost:', cost.id);
        } else {
          errors++;
        }
      } catch (err) {
        logger.error('[InventorySync] Error syncing cost:', cost.id, err);
        errors++;
      }
    }
    
    logger.debug('[InventorySync] Sync completed. Synced:', synced, 'Errors:', errors);
    
    if (synced > 0) {
      toast.success('Sincronización Completada', {
        description: `Se sincronizaron ${synced} costo(s) con inventario`,
      });
    }
    
    return { synced, errors };
  } catch (error) {
    logger.error('[InventorySync] Fatal error during sync:', error);
    toast.error('Error en Sincronización', {
      description: 'No se pudo completar la sincronización retroactiva',
    });
    return { synced, errors: errors + 1 };
  }
};
