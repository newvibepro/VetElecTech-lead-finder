/**
 * Netlify Function: Get contacts for one lead.
 * GET /.netlify/functions/getLeadContacts?leadId=123&minConfidence=60
 */

const { getServiceClient } = require('./lib/contactEnrichment');

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

exports.handler = async (event) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  try {
    const query = event.queryStringParameters || {};
    const leadId = toInt(query.leadId || query.id, NaN);
    const minConfidence = Math.max(0, Math.min(100, toInt(query.minConfidence, 0)));

    if (!Number.isFinite(leadId)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'leadId is required and must be numeric.' })
      };
    }

    const supabase = getServiceClient();
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Lead not found.' })
      };
    }

    const { data: contacts, error: contactsError } = await supabase
      .from('lead_contacts')
      .select('*')
      .eq('lead_id', leadId)
      .gte('confidence_score', minConfidence)
      .order('confidence_score', { ascending: false });

    if (contactsError) throw contactsError;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        lead,
        contacts: contacts || [],
        count: contacts?.length || 0
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};
