/**
 * Supabase Database Client — VetElecTech Lead Finder
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

class DatabaseManager {
  /**
   * Upsert a lead record (insert or update on conflict)
   */
  async upsertLead(leadData) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .upsert(
          {
            source:               leadData.source,
            source_id:            leadData.source_id,
            name:                 leadData.name,
            address:              leadData.address,
            city:                 leadData.city,
            state:                leadData.state,
            zip_code:             leadData.zip_code,
            latitude:             leadData.latitude,
            longitude:            leadData.longitude,
            phone:                leadData.phone,
            website:              leadData.website,
            google_maps_url:      leadData.google_maps_url,
            yelp_url:             leadData.yelp_url,

            // Scores
            connectivity_criticality_score: leadData.connectivity_criticality_score || 0,
            industry_alignment_score:       leadData.industry_alignment_score || 0,
            service_area_fit_score:         leadData.service_area_fit_score || 0,
            business_viability_score:       leadData.business_viability_score || 0,
            accessibility_score:            leadData.accessibility_score || 0,
            overall_score:                  leadData.overall_score || 0,

            // Business details
            business_type:  leadData.store_type,
            categories:     leadData.categories || [],
            description:    leadData.description,
            keywords:       leadData.keywords || [],

            // Review metrics
            yelp_rating:         leadData.yelp_rating,
            yelp_review_count:   leadData.yelp_review_count || 0,
            google_rating:       leadData.google_rating,
            google_review_count: leadData.google_review_count || 0,

            last_updated_at: new Date().toISOString(),
            last_scraped_at: new Date().toISOString()
          },
          { onConflict: 'source_id' }
        );

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('❌ Error upserting lead:', error.message);
      throw error;
    }
  }

  /**
   * Batch upsert leads
   */
  async batchUpsertLeads(leads) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .upsert(leads, { onConflict: 'source_id' });

      if (error) throw error;
      return { success: true, count: data?.length || 0 };
    } catch (error) {
      console.error('❌ Error batch upserting leads:', error.message);
      throw error;
    }
  }

  /**
   * Get top-scoring leads
   */
  async getTopLeads(limit = 50, state = null) {
    let query = supabase
      .from('leads')
      .select('*')
      .order('overall_score', { ascending: false })
      .limit(limit);

    if (state) query = query.eq('state', state);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Log a scraper run
   */
  async logScraperRun(runData) {
    try {
      const { error } = await supabase.from('scraper_runs').insert({
        source:       runData.source,
        leads_found:  runData.leads_found || 0,
        leads_saved:  runData.leads_saved || 0,
        errors_count: runData.errors_count || 0,
        duration_ms:  runData.duration_ms || 0,
        run_at:       new Date().toISOString()
      });
      if (error) throw error;
    } catch (error) {
      console.error('❌ Error logging scraper run:', error.message);
    }
  }
}

module.exports = DatabaseManager;
