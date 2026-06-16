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
    const { limit = 100, state, minScore = 0 } = event.queryStringParameters || {};

    let query = supabase
      .from('leads')
      .select('*')
      .gte('overall_score', parseInt(minScore) || 0)
      .order('overall_score', { ascending: false })
      .limit(Math.min(parseInt(limit) || 100, 500));

    if (state) query = query.eq('state', state);

    const { data, error } = await query;

    if (error) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ leads: data || [], count: data?.length || 0 })
    };
  } catch (error) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
  }
};
