/**
 * Netlify Function: Enrich contacts for a single lead.
 * POST /.netlify/functions/enrichLeadContacts with JSON { leadId: 123 }
 * GET  /.netlify/functions/enrichLeadContacts?leadId=123
 */

const {
  getServiceClient,
  enrichLeadContacts,
  upsertLeadContacts,
  fetchLeadContacts,
  updateLeadContactSummary
} = require('./lib/contactEnrichment');

function parseJsonBody(body) {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
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
    const body = parseJsonBody(event.body);
    const leadIdRaw = body.leadId || event.queryStringParameters?.leadId || event.queryStringParameters?.id;
    const leadId = parseInt(leadIdRaw, 10);

    if (!Number.isFinite(leadId)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'leadId is required and must be a number.' })
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

    const contacts = await enrichLeadContacts(lead);
    const upsertResult = await upsertLeadContacts(supabase, lead.id, contacts);
    await updateLeadContactSummary(supabase, lead, contacts);

    const grouped = await fetchLeadContacts(supabase, [lead.id], 0);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        leadId: lead.id,
        contactsFound: contacts.length,
        contactsUpserted: upsertResult.upserted,
        contacts: grouped[lead.id] || []
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
