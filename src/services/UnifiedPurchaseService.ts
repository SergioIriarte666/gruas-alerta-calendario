import { supabase } from '@/integrations/supabase/client';
import { showSyncToast, type SyncAction } from '@/utils/syncToast';

export interface UnifiedPurchaseData {
  // Item information
  itemName: string;
  itemId?: string; // If item already exists
  quantity: number;
  unitCost: number;
  
  // Purchase details
  date: string;
  supplierId?: string | null;
  supplierName?: string | null;
  locationId?: string | null;
  
  // Document references
  referenceDocument?: string | null;
  batchNumber?: string | null;
  expirationDate?: string | null;
  observations?: string | null;
  
  // Consumption options
  immediateConsumption: boolean;
  craneId?: string | null; // If specified → direct consumption to crane
  // If no craneId but immediateConsumption=true → caller should open multi-crane distribution dialog
}

export interface UnifiedPurchaseResult {
  success: boolean;
  costId: string | null;
  inventoryItemId: string | null;
  entryMovementId: string | null;
  exitMovementId: string | null; // Only if immediate consumption
  cranePartId: string | null;    // Only if assigned to crane
  requiresDistribution: boolean; // If true, caller should open multi-crane dialog
  error?: string;
}

/**
 * Unified Purchase Service
 * 
 * This is the SINGLE entry point for all inventory purchases.
 * It ensures data synchronization between:
 * - Costs (financial tracking)
 * - Inventory (stock management)
 * - Cranes (parts/consumption tracking)
 * 
 * Flow:
 * 1. Find or create inventory_item
 * 2. Get active warehouse location
 * 3. Create cost entry (category: Mantenimiento > Piezas y Repuestos)
 * 4. Create entry movement in inventory_movements with cost_id
 * 5. Update cost with inventory_movement_id (bidirectional link)
 * 6. If immediateConsumption=true:
 *    - If craneId specified → Create exit movement + crane_parts record
 *    - If no craneId → Return flag for multi-crane distribution dialog
 */
export class UnifiedPurchaseService {

  /**
   * Get current authenticated user ID
   */
  private static async getCurrentUserId(): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    } catch {
      return null;
    }
  }
  
  /**
   * Main method to register a purchase
   */
  static async registerPurchase(data: UnifiedPurchaseData): Promise<UnifiedPurchaseResult> {
    const result: UnifiedPurchaseResult = {
      success: false,
      costId: null,
      inventoryItemId: null,
      entryMovementId: null,
      exitMovementId: null,
      cranePartId: null,
      requiresDistribution: false,
    };

    try {
      console.log('[UnifiedPurchase] Starting purchase registration:', data.itemName);
      
      // Step 1: Find or create inventory item
      result.inventoryItemId = await this.findOrCreateInventoryItem(data);
      console.log('[UnifiedPurchase] Inventory item ID:', result.inventoryItemId);
      
      // Step 2: Get active warehouse location
      const locationId = data.locationId || await this.getDefaultLocation();
      if (!locationId) {
        throw new Error('No hay ubicación de inventario activa');
      }
      console.log('[UnifiedPurchase] Location ID:', locationId);
      
      // Step 3: Create cost entry
      result.costId = await this.createCostEntry(data);
      console.log('[UnifiedPurchase] Cost ID:', result.costId);
      
      // Step 4: Create entry movement with cost_id
      result.entryMovementId = await this.createEntryMovement({
        ...data,
        inventoryItemId: result.inventoryItemId,
        locationId,
        costId: result.costId,
      });
      console.log('[UnifiedPurchase] Entry movement ID:', result.entryMovementId);
      
      // Step 5: Update cost with inventory_movement_id (bidirectional link)
      await this.linkCostToMovement(result.costId, result.entryMovementId);
      
      // Step 6: Handle immediate consumption
      if (data.immediateConsumption) {
        if (data.craneId) {
          // Direct consumption to specific crane
          const consumptionResult = await this.createDirectConsumption({
            inventoryItemId: result.inventoryItemId,
            locationId,
            costId: result.costId,
            craneId: data.craneId,
            quantity: data.quantity,
            unitCost: data.unitCost,
            date: data.date,
            itemName: data.itemName,
            supplierId: data.supplierId,
            supplierName: data.supplierName,
          });
          result.exitMovementId = consumptionResult.exitMovementId;
          result.cranePartId = consumptionResult.cranePartId;
          console.log('[UnifiedPurchase] Direct consumption completed');
        } else {
          // Flag for multi-crane distribution dialog
          result.requiresDistribution = true;
          console.log('[UnifiedPurchase] Requires multi-crane distribution');
        }
      }
      
      result.success = true;
      console.log('[UnifiedPurchase] Purchase registration completed successfully');
      
      // Build sync actions for unified toast
      const syncActions: SyncAction[] = [
        { module: 'costo', action: `Costo registrado: $${(data.quantity * data.unitCost).toLocaleString('es-CL')}`, success: true },
        { module: 'inventario', action: `Entrada: ${data.quantity} ${data.itemName}`, success: true },
      ];
      if (result.cranePartId) {
        syncActions.push({ module: 'pieza', action: `Pieza asignada a grúa`, success: true });
      }
      if (data.supplierId) {
        syncActions.push({ module: 'pago', action: `Pago a proveedor creado`, success: true });
      }
      
      showSyncToast('Compra Registrada', syncActions);
      
      return result;
      
    } catch (error) {
      console.error('[UnifiedPurchase] Error:', error);
      result.error = error instanceof Error ? error.message : 'Error desconocido';
      
      // Attempt rollback if possible
      await this.attemptRollback(result);
      
      const { toast } = await import('sonner');
      toast.error('Error en Registro', {
        description: result.error,
      });
      
      return result;
    }
  }

  /**
   * Find existing inventory item or create new one
   */
  private static async findOrCreateInventoryItem(data: UnifiedPurchaseData): Promise<string> {
    // If itemId already provided, use it
    if (data.itemId) {
      return data.itemId;
    }

    const normalizedName = data.itemName.trim().toLowerCase();
    
    // Try to find existing item by normalized name
    const { data: existingItem } = await supabase
      .from('inventory_items')
      .select('id')
      .ilike('name', normalizedName)
      .eq('is_active', true)
      .limit(1)
      .single();
    
    if (existingItem) {
      return existingItem.id;
    }
    
    // Create new inventory item
    const { data: newItem, error } = await supabase
      .from('inventory_items')
      .insert({
        name: data.itemName.trim(),
        unit_of_measure: 'unidad',
        unit_cost: data.unitCost,
        is_active: true,
      })
      .select('id')
      .single();
    
    if (error || !newItem) {
      throw new Error(`No se pudo crear el ítem de inventario: ${error?.message || 'Error desconocido'}`);
    }
    
    return newItem.id;
  }

  /**
   * Get default active warehouse location
   */
  private static async getDefaultLocation(): Promise<string | null> {
    const { data: location } = await supabase
      .from('inventory_locations')
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    
    return location?.id || null;
  }

  /**
   * Create cost entry (category: Mantenimiento > Piezas y Repuestos)
   */
  private static async createCostEntry(data: UnifiedPurchaseData): Promise<string> {
    // Find "Mantenimiento" category
    const { data: category } = await supabase
      .from('cost_categories')
      .select('id')
      .ilike('name', '%mantenimiento%')
      .limit(1)
      .single();
    
    if (!category) {
      throw new Error('Categoría "Mantenimiento" no encontrada');
    }
    
    const totalCost = data.quantity * data.unitCost;
    
    const { data: cost, error } = await supabase
      .from('costs')
      .insert({
        amount: totalCost,
        category_id: category.id,
        date: data.date,
        description: data.itemName.trim(),
        subcategory: 'Piezas y Repuestos',
        notes: data.observations || null,
        crane_id: data.craneId || null,
        supplier_id: data.supplierId || null,
        purchase_quantity: data.quantity,
        purchase_unit_cost: data.unitCost,
        immediate_consumption: data.immediateConsumption,
      })
      .select('id')
      .single();
    
    if (error || !cost) {
      throw new Error(`No se pudo crear el costo: ${error?.message || 'Error desconocido'}`);
    }
    
    return cost.id;
  }

  /**
   * Create entry movement in inventory
   */
  private static async createEntryMovement(params: {
    inventoryItemId: string;
    locationId: string;
    costId: string;
    quantity: number;
    unitCost: number;
    date: string;
    supplierId?: string | null;
    supplierName?: string | null;
    referenceDocument?: string | null;
    batchNumber?: string | null;
    expirationDate?: string | null;
    observations?: string | null;
    itemName: string;
  }): Promise<string> {
    const totalCost = params.quantity * params.unitCost;

    const { data: existing } = await supabase
      .from('inventory_movements')
      .select('id')
      .eq('cost_id', params.costId)
      .eq('movement_type', 'entry')
      .eq('status', 'active')
      .maybeSingle();

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from('inventory_movements')
        .update({
          item_id: params.inventoryItemId,
          location_id: params.locationId,
          quantity: params.quantity,
          unit_cost: params.unitCost,
          total_cost: totalCost,
          movement_date: params.date,
          supplier_id: params.supplierId || null,
          supplier_name: params.supplierName || null,
          reference_document: params.referenceDocument || null,
          batch_number: params.batchNumber || null,
          expiration_date: params.expirationDate || null,
          observations: params.observations || `Compra registrada: ${params.itemName}`,
          reason: 'Compra de inventario',
        })
        .eq('id', existing.id);

      if (updateError) {
        throw new Error(`No se pudo actualizar el movimiento de entrada: ${updateError.message}`);
      }

      return existing.id;
    }

    const { data: similar } = await supabase
      .from('inventory_movements')
      .select('id')
      .eq('movement_type', 'entry')
      .eq('status', 'active')
      .eq('item_id', params.inventoryItemId)
      .eq('location_id', params.locationId)
      .eq('quantity', params.quantity)
      .eq('unit_cost', params.unitCost)
      .eq('movement_date', params.date)
      .maybeSingle();

    if (similar?.id) {
      const { error: updSimilarErr } = await supabase
        .from('inventory_movements')
        .update({
          cost_id: params.costId,
          total_cost: totalCost,
          supplier_id: params.supplierId || null,
          supplier_name: params.supplierName || null,
          reference_document: params.referenceDocument || null,
          batch_number: params.batchNumber || null,
          expiration_date: params.expirationDate || null,
          observations: params.observations || `Compra registrada: ${params.itemName}`,
          reason: 'Compra de inventario',
        })
        .eq('id', similar.id);
      if (updSimilarErr) {
        throw new Error(`No se pudo actualizar el movimiento de entrada (similar): ${updSimilarErr.message}`);
      }
      return similar.id;
    }
    
    const { data: movement, error } = await supabase
      .from('inventory_movements')
      .insert({
        item_id: params.inventoryItemId,
        location_id: params.locationId,
        movement_type: 'entry',
        quantity: params.quantity,
        unit_cost: params.unitCost,
        total_cost: totalCost,
        movement_date: params.date,
        reason: 'Compra de inventario',
        observations: params.observations || `Compra registrada: ${params.itemName}`,
        status: 'active',
        cost_id: params.costId,
        supplier_id: params.supplierId || null,
        supplier_name: params.supplierName || null,
        reference_document: params.referenceDocument || null,
        batch_number: params.batchNumber || null,
        expiration_date: params.expirationDate || null,
      })
      .select('id')
      .single();
    
    if (error || !movement) {
      throw new Error(`No se pudo crear el movimiento de entrada: ${error?.message || 'Error desconocido'}`);
    }
    
    return movement.id;
  }

  /**
   * Link cost to inventory movement (bidirectional)
   */
  private static async linkCostToMovement(costId: string, movementId: string): Promise<void> {
    const { error } = await supabase
      .from('costs')
      .update({ inventory_movement_id: movementId })
      .eq('id', costId);
    
    if (error) {
      console.warn('[UnifiedPurchase] Warning: Could not link cost to movement:', error.message);
      // Non-fatal, continue
    }
  }

  /**
   * Create direct consumption (exit movement + crane_parts)
   */
  private static async createDirectConsumption(params: {
    inventoryItemId: string;
    locationId: string;
    costId: string;
    craneId: string;
    quantity: number;
    unitCost: number;
    date: string;
    itemName: string;
    supplierId?: string | null;
    supplierName?: string | null;
    supplierInvoiceId?: string | null;
    supplierInvoiceItemId?: string | null;
    referenceDocument?: string | null;
    displayUnitCost?: number | null;
    displayTotalCost?: number | null;
  }): Promise<{ exitMovementId: string; cranePartId: string | null }> {
    const totalCost = params.quantity * params.unitCost;

    let existingQuery = supabase
      .from('inventory_movements')
      .select('id')
      .eq('cost_id', params.costId)
      .eq('movement_type', 'exit')
      .eq('status', 'active');

    existingQuery = params.supplierInvoiceItemId
      ? existingQuery.eq('supplier_invoice_item_id', params.supplierInvoiceItemId)
      : existingQuery.limit(1);

    const { data: existing } = await existingQuery.maybeSingle();

    const upsertCranePart = async (exitMovementId: string): Promise<string | null> => {
      const cranePartPayload = {
        crane_id: params.craneId,
        part_name: params.itemName,
        quantity: params.quantity,
        unit_price: params.displayUnitCost ?? params.unitCost,
        date: params.date,
        supplier: params.supplierName || 'Desde inventario',
        supplier_id: params.supplierId || null,
        cost_id: params.costId,
        inventory_movement_id: exitMovementId,
        notes: params.supplierInvoiceId
          ? `Consumo inmediato desde factura XML ${params.supplierInvoiceId}`
          : 'Consumo inmediato desde costo',
      };

      const { data: existingCranePart } = await supabase
        .from('crane_parts')
        .select('id')
        .eq('inventory_movement_id', exitMovementId)
        .maybeSingle();

      if (existingCranePart?.id) {
        const { error: updateCranePartError } = await supabase
          .from('crane_parts')
          .update(cranePartPayload)
          .eq('id', existingCranePart.id);

        if (updateCranePartError) {
          console.warn('[UnifiedPurchase] Warning: Could not update crane_part:', updateCranePartError.message);
          return null;
        }

        return existingCranePart.id;
      }

      const { data: cranePart, error: cranePartError } = await supabase
        .from('crane_parts')
        .insert(cranePartPayload)
        .select('id')
        .single();

      if (cranePartError) {
        console.warn('[UnifiedPurchase] Warning: Could not create crane_part:', cranePartError.message);
        return null;
      }

      return cranePart?.id || null;
    };

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from('inventory_movements')
        .update({
          item_id: params.inventoryItemId,
          location_id: params.locationId,
          quantity: params.quantity,
          unit_cost: params.unitCost,
          total_cost: totalCost,
          movement_date: params.date,
          reason: 'Consumo inmediato',
          observations: `Consumo inmediato - ${params.itemName}`,
          crane_id: params.craneId,
          supplier_id: params.supplierId || null,
          supplier_name: params.supplierName || null,
          reference_document: params.referenceDocument || null,
          supplier_invoice_id: params.supplierInvoiceId || null,
          supplier_invoice_item_id: params.supplierInvoiceItemId || null,
        })
        .eq('id', existing.id);

      if (updateError) {
        throw new Error(`No se pudo actualizar el movimiento de salida: ${updateError.message}`);
      }

      const cranePartId = await upsertCranePart(existing.id);
      return { exitMovementId: existing.id, cranePartId };
    }

    let similarQuery = supabase
      .from('inventory_movements')
      .select('id')
      .eq('movement_type', 'exit')
      .eq('status', 'active')
      .eq('item_id', params.inventoryItemId)
      .eq('location_id', params.locationId)
      .eq('crane_id', params.craneId)
      .eq('quantity', params.quantity)
      .eq('unit_cost', params.unitCost)
      .eq('movement_date', params.date);

    similarQuery = params.supplierInvoiceItemId
      ? similarQuery.eq('supplier_invoice_item_id', params.supplierInvoiceItemId)
      : similarQuery.limit(1);

    const { data: similarExit } = await similarQuery.maybeSingle();

    if (similarExit?.id) {
      const { error: updSimilarExitErr } = await supabase
        .from('inventory_movements')
        .update({
          cost_id: params.costId,
          total_cost: totalCost,
          reason: 'Consumo inmediato',
          observations: `Consumo inmediato - ${params.itemName}`,
          supplier_id: params.supplierId || null,
          supplier_name: params.supplierName || null,
          reference_document: params.referenceDocument || null,
          supplier_invoice_id: params.supplierInvoiceId || null,
          supplier_invoice_item_id: params.supplierInvoiceItemId || null,
        })
        .eq('id', similarExit.id);
      if (updSimilarExitErr) {
        throw new Error(`No se pudo actualizar el movimiento de salida (similar): ${updSimilarExitErr.message}`);
      }
      const cranePartId = await upsertCranePart(similarExit.id);
      return { exitMovementId: similarExit.id, cranePartId };
    }
    
    // Create exit movement
    const { data: exitMovement, error: exitError } = await supabase
      .from('inventory_movements')
      .insert({
        item_id: params.inventoryItemId,
        location_id: params.locationId,
        movement_type: 'exit',
        quantity: params.quantity,
        unit_cost: params.unitCost,
        total_cost: totalCost,
        movement_date: params.date,
        reason: 'Consumo inmediato',
        observations: `Consumo inmediato - ${params.itemName}`,
        status: 'active',
        crane_id: params.craneId,
        cost_id: params.costId,
        supplier_id: params.supplierId || null,
        supplier_name: params.supplierName || null,
        reference_document: params.referenceDocument || null,
        supplier_invoice_id: params.supplierInvoiceId || null,
        supplier_invoice_item_id: params.supplierInvoiceItemId || null,
      })
      .select('id')
      .single();
    
    if (exitError || !exitMovement) {
      throw new Error(`No se pudo crear el movimiento de salida: ${exitError?.message || 'Error desconocido'}`);
    }

    const cranePartId = await upsertCranePart(exitMovement.id);
    return { exitMovementId: exitMovement.id, cranePartId };
  }

  static async clearImmediateConsumptionForCost(costId: string): Promise<void> {
    const { data: exitMovements, error: exitMovementsError } = await supabase
      .from('inventory_movements')
      .select('id')
      .eq('cost_id', costId)
      .eq('movement_type', 'exit')
      .eq('status', 'active');

    if (exitMovementsError) {
      throw new Error(`No se pudieron consultar salidas asociadas al costo: ${exitMovementsError.message}`);
    }

    const exitMovementIds = (exitMovements || []).map((movement) => movement.id);

    if (exitMovementIds.length > 0) {
      const { error: deleteCranePartsError } = await supabase
        .from('crane_parts')
        .delete()
        .in('inventory_movement_id', exitMovementIds);

      if (deleteCranePartsError) {
        throw new Error(`No se pudieron limpiar piezas de grúa: ${deleteCranePartsError.message}`);
      }

      const { error: deleteExitMovementsError } = await supabase
        .from('inventory_movements')
        .delete()
        .in('id', exitMovementIds);

      if (deleteExitMovementsError) {
        throw new Error(`No se pudieron limpiar consumos inmediatos: ${deleteExitMovementsError.message}`);
      }
    }
  }

  static async syncImportedInvoiceConsumption(params: {
    costId: string;
    supplierInvoiceId: string;
    craneId: string;
    date: string;
    supplierId?: string | null;
    supplierName?: string | null;
    referenceDocument?: string | null;
  }): Promise<void> {
    const { data: invoiceItems, error: invoiceItemsError } = await supabase
      .from('supplier_invoice_items')
      .select('id, description, quantity, unit_price, total_amount, inventory_item_id, movement_id')
      .eq('supplier_invoice_id', params.supplierInvoiceId)
      .order('line_number', { ascending: true });

    if (invoiceItemsError) {
      throw new Error(`No se pudieron cargar las líneas de la factura: ${invoiceItemsError.message}`);
    }

    if (!invoiceItems?.length) {
      throw new Error('La factura no tiene líneas para consumo inmediato');
    }

    let firstExitMovementId: string | null = null;

    for (const item of invoiceItems) {
      const { data: entryMovement, error: entryMovementError } = await supabase
        .from('inventory_movements')
        .select('id, item_id, location_id, movement_date, supplier_invoice_id, supplier_invoice_item_id')
        .eq('supplier_invoice_item_id', item.id)
        .eq('movement_type', 'entry')
        .eq('status', 'active')
        .maybeSingle();

      if (entryMovementError) {
        throw new Error(`No se pudo validar la entrada de inventario para la línea ${item.id}: ${entryMovementError.message}`);
      }

      if (!entryMovement?.item_id || !entryMovement?.location_id) {
        throw new Error(`La línea ${item.description} no tiene una entrada de inventario válida para consumir`);
      }

      const consumption = await this.createDirectConsumption({
        inventoryItemId: entryMovement.item_id,
        locationId: entryMovement.location_id,
        costId: params.costId,
        craneId: params.craneId,
        quantity: item.quantity,
        unitCost: Number(item.unit_price || 0),
        date: entryMovement.movement_date || params.date,
        itemName: item.description,
        supplierId: params.supplierId,
        supplierName: params.supplierName,
        supplierInvoiceId: params.supplierInvoiceId,
        supplierInvoiceItemId: item.id,
        referenceDocument: params.referenceDocument,
        displayUnitCost: item.total_amount ? Number(item.total_amount) / Math.max(Number(item.quantity), 1) : Number(item.unit_price || 0),
        displayTotalCost: item.total_amount ? Number(item.total_amount) : Number(item.unit_price || 0) * Number(item.quantity || 0),
      });

      if (!firstExitMovementId) {
        firstExitMovementId = consumption.exitMovementId;
      }
    }

    if (firstExitMovementId) {
      await this.linkCostToMovement(params.costId, firstExitMovementId);
    }
  }

  /**
   * Attempt to rollback partially created records
   */
  private static async attemptRollback(result: UnifiedPurchaseResult): Promise<void> {
    try {
      // Cancel movements if created
      if (result.exitMovementId) {
        await supabase
          .from('inventory_movements')
          .update({ status: 'cancelled' })
          .eq('id', result.exitMovementId);
      }
      
      if (result.entryMovementId) {
        await supabase
          .from('inventory_movements')
          .update({ status: 'cancelled' })
          .eq('id', result.entryMovementId);
      }
      
      // Note: We don't delete cost because it might have other dependencies
      // Instead, we log for manual review
      if (result.costId) {
        console.warn('[UnifiedPurchase] Rollback: Cost created but may need manual review:', result.costId);
      }
    } catch (rollbackError) {
      console.error('[UnifiedPurchase] Rollback failed:', rollbackError);
    }
  }

  /**
   * Create consumption from inventory (exit movement + crane_parts)
   * Used when distributing purchased items to cranes
   */
  static async createConsumption(params: {
    inventoryItemId: string;
    locationId: string;
    craneId: string;
    quantity: number;
    unitCost: number;
    date: string;
    itemName: string;
    costId?: string; // Original cost if linking
    supplierId?: string | null;
  }): Promise<{ exitMovementId: string; cranePartId: string | null }> {
    const totalCost = params.quantity * params.unitCost;
    
    // Check available stock
    const { data: stockData } = await supabase
      .from('inventory_stock')
      .select('current_quantity')
      .eq('item_id', params.inventoryItemId)
      .eq('location_id', params.locationId)
      .single();
    
    if (!stockData || stockData.current_quantity < params.quantity) {
      throw new Error(`Stock insuficiente. Disponible: ${stockData?.current_quantity || 0}, Solicitado: ${params.quantity}`);
    }
    
    // Create exit movement
    const { data: exitMovement, error: exitError } = await supabase
      .from('inventory_movements')
      .insert({
        item_id: params.inventoryItemId,
        location_id: params.locationId,
        movement_type: 'exit',
        quantity: params.quantity,
        unit_cost: params.unitCost,
        total_cost: totalCost,
        movement_date: params.date,
        reason: 'Consumo a grúa',
        observations: 'Distribución desde inventario',
        status: 'active',
        crane_id: params.craneId,
        cost_id: params.costId || null,
      })
      .select('id')
      .single();
    
    if (exitError || !exitMovement) {
      throw new Error(`No se pudo crear el movimiento de salida: ${exitError?.message || 'Error desconocido'}`);
    }
    
    // Create crane_parts record
    const { data: cranePart, error: cranePartError } = await supabase
      .from('crane_parts')
      .insert({
        crane_id: params.craneId,
        part_name: params.itemName,
        quantity: params.quantity,
        unit_price: params.unitCost,
        date: params.date,
        supplier: 'Desde inventario',
        supplier_id: params.supplierId || null,
        cost_id: params.costId || null,
        inventory_movement_id: exitMovement.id,
        notes: 'Distribución desde inventario',
      })
      .select('id')
      .single();
    
    if (cranePartError) {
      console.warn('[UnifiedPurchase] Warning: Could not create crane_part:', cranePartError.message);
    }
    
    return {
      exitMovementId: exitMovement.id,
      cranePartId: cranePart?.id || null,
    };
  }

  /**
   * Register inventory movements and crane_parts for an EXISTING cost.
   * Unlike registerPurchase(), this does NOT create a second cost entry.
   * Used when CostForm already created the cost via addCost/updateCost.
   */
  static async registerForExistingCost(params: {
    costId: string;
    itemName: string;
    quantity: number;
    unitCost: number;
    date: string;
    craneId: string;
    supplierId?: string | null;
    supplierName?: string | null;
  }): Promise<void> {
    try {
      console.log('[UnifiedPurchase] registerForExistingCost - costId:', params.costId);

      // 1. Find or create inventory item
      const inventoryItemId = await this.findOrCreateInventoryItem({
        itemName: params.itemName,
        quantity: params.quantity,
        unitCost: params.unitCost,
        date: params.date,
        immediateConsumption: true,
      });

      // 2. Get warehouse location
      const locationId = await this.getDefaultLocation();
      if (!locationId) {
        throw new Error('No hay ubicación de inventario activa');
      }

      // 3. Create entry movement linked to existing cost
      const entryMovementId = await this.createEntryMovement({
        inventoryItemId,
        locationId,
        costId: params.costId,
        quantity: params.quantity,
        unitCost: params.unitCost,
        date: params.date,
        supplierId: params.supplierId,
        supplierName: params.supplierName,
        itemName: params.itemName,
      });

      // 4. Link cost to entry movement
      await this.linkCostToMovement(params.costId, entryMovementId);

      // 5. Create exit movement + crane_parts
      await this.createDirectConsumption({
        inventoryItemId,
        locationId,
        costId: params.costId,
        craneId: params.craneId,
        quantity: params.quantity,
        unitCost: params.unitCost,
        date: params.date,
        itemName: params.itemName,
        supplierId: params.supplierId,
        supplierName: params.supplierName,
      });

      console.log('[UnifiedPurchase] registerForExistingCost completed successfully');

      const { showSyncToast } = await import('@/utils/syncToast');
      showSyncToast('Inventario Sincronizado', [
        { module: 'inventario', action: `Entrada: ${params.quantity} ${params.itemName}`, success: true },
        { module: 'pieza', action: 'Pieza asignada a grúa', success: true },
      ]);
    } catch (error) {
      console.error('[UnifiedPurchase] registerForExistingCost error:', error);
      const { toast } = await import('sonner');
      toast.error('Error de Inventario', {
        description: error instanceof Error ? error.message : 'No se pudieron crear los movimientos de inventario',
      });
    }
  }
}
