import { supabase } from '@/integrations/supabase/client';

interface CreateInventoryCostData {
  amount: number;
  description: string;
  date: string;
  item_name: string;
  supplier_name?: string;
  quantity: number;
  unit_cost: number;
  subcategory_name?: string;
}

export const createInventoryCost = async ({
  amount,
  description,
  date,
  item_name,
  supplier_name,
  quantity,
  unit_cost,
  subcategory_name
}: CreateInventoryCostData) => {
  // Get or create "Inventario" cost category
  let { data: category } = await supabase
    .from('cost_categories')
    .select('id')
    .ilike('name', '%inventario%')
    .single();

  if (!category) {
    const { data: newCategory, error: categoryError } = await supabase
      .from('cost_categories')
      .insert({
        name: 'Inventario',
        description: 'Gastos relacionados con compras de inventario'
      })
      .select('id')
      .single();

    if (categoryError) throw categoryError;
    category = newCategory;
  }

  // Determine subcategory dynamically
  let finalSubcategory: string | null = null;

  if (subcategory_name) {
    // If manually specified, use it
    finalSubcategory = subcategory_name;
  } else {
    // Fetch first active subcategory for "Inventario" category
    const { data: subcategories } = await supabase
      .from('cost_subcategories')
      .select('name')
      .eq('category_id', category.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(1);

    if (subcategories && subcategories.length > 0) {
      finalSubcategory = subcategories[0].name;
    }
    // If no subcategories configured, finalSubcategory remains null
  }

  // Create the cost entry
  const costDescription = `Compra de inventario: ${item_name} (${quantity} unidades a $${unit_cost.toLocaleString()} c/u)`;
  const notes = supplier_name ? `Proveedor: ${supplier_name}` : undefined;

  const { data: cost, error: costError } = await supabase
    .from('costs')
    .insert({
      amount,
      category_id: category.id,
      date,
      description: costDescription,
      notes,
      subcategory: finalSubcategory
    })
    .select('id')
    .single();

  if (costError) throw costError;
  return cost;
};