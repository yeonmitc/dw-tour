import { supabase } from '../../lib/supabase';

export const suppliersApi = {
  // --- Suppliers ---
  async getSuppliers() {
    const { data, error } = await supabase.from('suppliers').select('*').order('name');

    if (error) throw error;
    return data;
  },

  async getSupplier(id) {
    const { data, error } = await supabase
      .from('suppliers')
      .select(
        `
        *,
        golf_courses(*),
        hotel_room_types(*),
        villa_units(*),
        vehicles(*)
      `
      )
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async createSupplier(supplier) {
    const { data, error } = await supabase.from('suppliers').insert(supplier).select().single();

    if (error) throw error;
    return data;
  },

  async updateSupplier(id, updates) {
    const { data, error } = await supabase
      .from('suppliers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // --- Pricing Rules ---
  async getPricingRules(supplierId) {
    const { data, error } = await supabase
      .from('pricing_rules')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('priority', { ascending: false }); // 높은 우선순위 먼저

    if (error) throw error;
    return data;
  },

  async createPricingRule(rule) {
    const { data, error } = await supabase.from('pricing_rules').insert(rule).select().single();

    if (error) throw error;
    return data;
  },

  async updatePricingRule(id, updates) {
    const { data, error } = await supabase
      .from('pricing_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deletePricingRule(id) {
    const { error } = await supabase.from('pricing_rules').delete().eq('id', id);

    if (error) throw error;
    return true;
  },

  // --- Holidays ---
  async getHolidays(branch = null) {
    let query = supabase.from('holidays').select('*').eq('is_active', true).order('date');

    if (branch) {
      // branch가 null(전체)이거나 해당 branch인 경우
      query = query.or(`branch.is.null,branch.eq.${branch}`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },
};
