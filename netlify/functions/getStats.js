/**
 * Netlify Function: Get Lead Stats
 * GET /.netlify/functions/getStats?state=TX
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

function calculateMedian(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1);
}

function groupByState(rows) {
  return rows.reduce((acc, row) => {
    if (!acc[row.state]) acc[row.state] = { count: 0, total_score: 0 };
    acc[row.state].count++;
    acc[row.state].total_score += row.overall_score || 0;
    return acc;
  }, {});
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
    const { state } = event.queryStringParameters || {};

    let query = supabase
      .from('leads')
      .select('overall_score, state, connectivity_criticality_score, industry_alignment_score, business_type');

    if (state) query = query.eq('state', state);

    const { data, error } = await query;
    if (error) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };

    const scores = data?.map(l => l.overall_score) || [];

    const stats = {
      total_leads:      data?.length || 0,
      avg_score:        scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0,
      median_score:     calculateMedian(scores),
      high_quality_70:  scores.filter(s => s >= 70).length,
      high_quality_80:  scores.filter(s => s >= 80).length,
      high_quality_90:  scores.filter(s => s >= 90).length,
      min_score:        scores.length ? Math.min(...scores) : 0,
      max_score:        scores.length ? Math.max(...scores) : 0,
      by_state:         groupByState(data || [])
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(stats)
    };
  } catch (error) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
  }
};
