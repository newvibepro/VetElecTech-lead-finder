/**
 * Netlify Function: Get Top Leads
 * GET /.netlify/functions/getTopLeads?limit=50&state=TX
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
      limit = 100,
      state,
      minScore = 0,
      includeContacts = '0',
      minContactConfidence = 0
    } = event.queryStringParameters || {};

    const includeContactsEnabled = /^(1|true|yes|on)$/i.test(String(includeContacts));
    const minConfidence = Math.max(0, Math.min(100, parseInt(minContactConfidence, 10) || 0));

    let query = supabase
      .from('leads')
      .select('*')
      .gte('overall_score', parseInt(minScore) || 0)
      .order('overall_score', { ascending: false })
      .limit(Math.min(parseInt(limit) || 100, 500));

    if (state) query = query.eq('state', state);

    const { data, error } = await query;

    if (error) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };

    let leads = data || [];

    if (includeContactsEnabled && leads.length > 0) {
      const leadIds = leads.map((lead) => lead.id).filter(Boolean);

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

          leads = leads.map((lead) => ({
            ...lead,
            contacts: grouped[lead.id] || []
          }));
        }
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ leads, count: leads.length })
    };
  } catch (error) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
  }
};
