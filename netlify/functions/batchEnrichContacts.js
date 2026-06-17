/**
 * Netlify Function: Batch enrich contacts.
 * POST /.netlify/functions/batchEnrichContacts with JSON { leadIds: [1,2,3] }
 * GET  /.netlify/functions/batchEnrichContacts?limit=50&state=TX&minScore=60&onlyMissing=1
 */

const {
  getServiceClient,
  enrichLeadContacts,
  upsertLeadContacts,
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

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isTruthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

async function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    const supabase = getServiceClient();
    const body = parseJsonBody(event.body);
    const query = event.queryStringParameters || {};

    const maxLeads = Math.max(1, Math.min(500, toInt(query.limit, toInt(process.env.CONTACT_BATCH_MAX_LEADS, 150))));
    const minScore = Math.max(0, Math.min(100, toInt(query.minScore, 0)));
    const state = String(query.state || '').toUpperCase();
    const onlyMissing = isTruthy(query.onlyMissing || body.onlyMissing || '1');
    const rateLimitPerMin = Math.max(5, toInt(process.env.CONTACT_RATE_LIMIT_PER_MIN, 45));
    const delayMs = Math.ceil(60000 / rateLimitPerMin);

    let leads = [];

    if (Array.isArray(body.leadIds) && body.leadIds.length) {
      const leadIds = body.leadIds
        .map((id) => parseInt(id, 10))
        .filter((id) => Number.isFinite(id))
        .slice(0, maxLeads);

      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .in('id', leadIds)
        .order('overall_score', { ascending: false });

      if (error) throw error;
      leads = data || [];
    } else {
      let leadQuery = supabase
        .from('leads')
        .select('*')
        .gte('overall_score', minScore)
        .order('overall_score', { ascending: false })
        .limit(maxLeads);

      if (state) leadQuery = leadQuery.eq('state', state);
      if (onlyMissing) {
        leadQuery = leadQuery.or('contacts_enrichment_status.is.null,contacts_enrichment_status.eq.not_started,contacts_enrichment_status.eq.failed,contacts_enrichment_status.eq.no_contacts');
      }

      const { data, error } = await leadQuery;
      if (error) throw error;
      leads = data || [];
    }

    const startedAt = Date.now();
    let leadsAttempted = 0;
    let contactsCreated = 0;
    let errorsCount = 0;

    for (const lead of leads) {
      leadsAttempted += 1;
      try {
        const contacts = await enrichLeadContacts(lead);
        const result = await upsertLeadContacts(supabase, lead.id, contacts);
        contactsCreated += result.upserted;
        await updateLeadContactSummary(supabase, lead, contacts);
      } catch (error) {
        errorsCount += 1;
        await supabase
          .from('leads')
          .update({
            contacts_enrichment_status: 'failed',
            contacts_enriched_at: new Date().toISOString()
          })
          .eq('id', lead.id);
        console.error('batchEnrichContacts lead error:', error.message);
      }

      await pause(delayMs);
    }

    const durationMs = Date.now() - startedAt;

    await supabase.from('enrichment_runs').insert({
      run_type: 'batch',
      leads_attempted: leadsAttempted,
      contacts_created: contactsCreated,
      contacts_updated: 0,
      errors_count: errorsCount,
      duration_ms: durationMs
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        leadsAttempted,
        contactsCreated,
        errorsCount,
        durationMs
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
