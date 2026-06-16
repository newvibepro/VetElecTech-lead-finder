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
    const { q, state, minScore = 0 } = event.queryStringParameters || {};

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

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ results: data || [], count: data?.length || 0 })
    };
  } catch (error) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
  }
};
