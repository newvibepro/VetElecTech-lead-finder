/**
 * Netlify Function: Search Leads
 * GET /.netlify/functions/searchLeads?q=hospital&state=TX&minScore=60
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

exports.handler = async (event) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  try {
    const {
      q,
      state,
      minScore = 0,
      includeContacts = '0',
      minContactConfidence = 0
    } = event.queryStringParameters || {};

    const includeContactsEnabled = /^(1|true|yes|on)$/i.test(String(includeContacts));
    const minConfidence = Math.max(0, Math.min(100, parseInt(minContactConfidence, 10) || 0));

    if (!q) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Query parameter "q" is required' }) };
    }

    let query = supabase
      .from('leads')
      .select('*')
      .gte('overall_score', parseInt(minScore) || 0)
      .or(`name.ilike.%${q}%,description.ilike.%${q}%,business_type.ilike.%${q}%,keywords.cs.{${q}}`)
      .order('overall_score', { ascending: false })
      .limit(100);

    if (state) query = query.eq('state', state);

    const { data, error } = await query;

    if (error) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };

    let results = data || [];

    if (includeContactsEnabled && results.length > 0) {
      const leadIds = results.map((lead) => lead.id).filter(Boolean);

      if (leadIds.length > 0) {
        const { data: contacts, error: contactsError } = await supabase
          .from('lead_contacts')
          .select('*')
          .in('lead_id', leadIds)
          .gte('confidence_score', minConfidence)
          .order('confidence_score', { ascending: false });

        if (!contactsError) {
          const grouped = (contacts || []).reduce((acc, contact) => {
            if (!acc[contact.lead_id]) acc[contact.lead_id] = [];
            acc[contact.lead_id].push(contact);
            return acc;
          }, {});

          results = results.map((lead) => ({
            ...lead,
            contacts: grouped[lead.id] || []
          }));
        }
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ results, count: results.length })
    };
  } catch (error) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
  }
};
