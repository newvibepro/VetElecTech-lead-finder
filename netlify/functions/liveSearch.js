/**
 * Netlify Function: Live Lead Discovery
 * GET /.netlify/functions/liveSearch?q=hospital&state=TX&minScore=60&limit=40&maxTerms=3&sources=all
 *
 * This endpoint performs on-demand discovery against Google Maps and Yelp,
 * scores each lead for Starlink fit, and returns ranked results immediately.
 */

const GoogleMapsScraper = require('../../scripts/lib/googleMapsScraper');
const YelpScraper = require('../../scripts/lib/yelpScraper');
const ScoringEngine = require('../../scripts/lib/scorer');
const DatabaseManager = require('../../scripts/lib/db');
const { createClient } = require('@supabase/supabase-js');

const STATE_LOCATIONS = {
  TX: 'Austin, TX',
  FL: 'Orlando, FL',
  GA: 'Atlanta, GA',
  NC: 'Raleigh, NC',
  TN: 'Nashville, TN',
  VA: 'Richmond, VA',
  AL: 'Montgomery, AL',
  SC: 'Columbia, SC',
  OK: 'Oklahoma City, OK',
  LA: 'Baton Rouge, LA',
  MS: 'Jackson, MS',
  AR: 'Little Rock, AR',
  KY: 'Louisville, KY',
  WV: 'Charleston, WV',
  MT: 'Helena, MT',
  ND: 'Bismarck, ND',
  SD: 'Sioux Falls, SD',
  WY: 'Casper, WY',
  ID: 'Boise, ID',
  NE: 'Omaha, NE'
};

const CONNECTIVITY_COST_PRESSURE_SIGNALS = [
  'unreliable internet', 'poor connectivity', 'slow internet', 'slow speeds',
  'latency', 'dropped connection', 'frequent outages', 'outage',
  'internet down', 'backup internet', 'redundancy', 'failover',
  'no fiber', 'fiber unavailable', 'limited isp',
  'expensive internet', 'high internet cost', 'connectivity issues',
  'remote', 'rural', 'off-grid'
];

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseSources(raw) {
  if (!raw || raw === 'all') return { maps: true, yelp: true };
  const parts = String(raw).toLowerCase().split(',').map(s => s.trim());
  return {
    maps: parts.includes('maps') || parts.includes('google'),
    yelp: parts.includes('yelp')
  };
}

function parseCsvTerms(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map(term => term.trim())
    .filter(Boolean);
}

function isTruthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

function buildSearchTerms(userTerm, maxTerms, extraTerms = []) {
  const base = (userTerm || '').trim();
  const defaultSuffixes = parseCsvTerms(
    process.env.LIVE_SEARCH_TERM_SUFFIXES ||
    'unreliable internet,slow internet speeds,high internet cost,backup internet,rural connectivity'
  );

  const suffixed = defaultSuffixes.map(suffix => `${base} ${suffix}`);
  const candidates = uniq([
    base,
    ...suffixed,
    ...extraTerms
  ]);
  return candidates.slice(0, Math.max(1, maxTerms));
}

function buildLeadText(lead) {
  return [
    lead.name || '',
    lead.description || '',
    lead.store_type || '',
    (lead.categories || []).join(' '),
    (lead.keywords || []).join(' '),
    lead.address || '',
    lead.city || '',
    lead.state || ''
  ].join(' ').toLowerCase();
}

function scoreConnectivityCostPressure(lead, userTerm) {
  const text = `${buildLeadText(lead)} ${(userTerm || '').toLowerCase()}`;
  const matches = CONNECTIVITY_COST_PRESSURE_SIGNALS.filter(signal => text.includes(signal));

  let score = Math.min(matches.length * 12, 72);

  // Rural + no obvious enterprise fiber profile often indicates Starlink value.
  if ((lead.categories || []).some(c => /farm|agri|ranch|remote|rural/i.test(c))) score += 12;
  if (/warehouse|construction|industrial|logistics|hotel|resort|campus|clinic|hospital/i.test(text)) score += 10;
  if (!lead.website) score += 3;
  if (!lead.phone) score += 3;

  return {
    score: Math.min(Math.round(score), 100),
    matchedSignals: matches.slice(0, 8)
  };
}

function dedupeLeads(leads) {
  const seen = new Set();
  const output = [];

  for (const lead of leads) {
    const key = `${(lead.name || '').toLowerCase()}|${(lead.city || '').toLowerCase()}|${(lead.state || '').toLowerCase()}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(lead);
  }

  return output;
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
    const {
      q,
      state = '',
      minScore = 0,
      limit = 40,
      maxTerms = 3,
      sources = 'all',
      extraTerms = '',
      includeContacts = '0',
      minContactConfidence = 0,
      rawMode = '0',
      scoreTopN = 10
    } = event.queryStringParameters || {};

    if (!q || !q.trim()) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Query parameter "q" is required' })
      };
    }

    const sourceFlags = parseSources(sources);
    const hasMapsKey = Boolean(process.env.GOOGLE_MAPS_API_KEY);
    const hasYelpKey = Boolean(process.env.YELP_API_KEY);

    if ((sourceFlags.maps && !hasMapsKey) && (sourceFlags.yelp && !hasYelpKey)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing API keys. Configure GOOGLE_MAPS_API_KEY and/or YELP_API_KEY.' })
      };
    }

    const normalizedState = String(state || '').toUpperCase();
    const location = normalizedState ? (STATE_LOCATIONS[normalizedState] || `${normalizedState}, USA`) : 'United States';

    const finalLimit = Math.min(Math.max(toInt(limit, 40), 1), 100);
    const finalMinScore = Math.min(Math.max(toInt(minScore, 0), 0), 100);
    const finalMaxTerms = Math.min(Math.max(toInt(maxTerms, 3), 1), 6);
    const includeContactsEnabled = isTruthy(includeContacts);
    const finalMinContactConfidence = Math.min(Math.max(toInt(minContactConfidence, 0), 0), 100);
    const rawModeEnabled = isTruthy(rawMode);
    const finalScoreTopN = Math.min(Math.max(toInt(scoreTopN, 10), 1), 50);
    const customTerms = parseCsvTerms(extraTerms);
    const terms = rawModeEnabled
      ? [String(q).trim()]
      : buildSearchTerms(q, finalMaxTerms, customTerms);

    const scorer = new ScoringEngine();
    const allRawLeads = [];
    const diagnostics = {
      terms,
      sources: sourceFlags,
      rawModeEnabled,
      scoreTopN: finalScoreTopN,
      location,
      googleCount: 0,
      yelpCount: 0,
      saveEnabled: Boolean(process.env.SUPABASE_SERVICE_KEY),
      savedCount: 0,
      saveErrors: 0
    };

    if (sourceFlags.maps && hasMapsKey) {
      const maps = new GoogleMapsScraper(process.env.GOOGLE_MAPS_API_KEY);
      for (const term of terms) {
        try {
          const places = await maps.searchBusinesses(term, location);
          const normalized = places.map(place => maps.normalizeLead(place));
          diagnostics.googleCount += normalized.length;
          allRawLeads.push(...normalized);
        } catch (error) {
          console.error(`liveSearch maps error for term "${term}":`, error.message);
        }
      }
    }

    if (sourceFlags.yelp && hasYelpKey) {
      const yelp = new YelpScraper(process.env.YELP_API_KEY);
      for (const term of terms) {
        try {
          const businesses = await yelp.searchBusinesses(term, location, 'best_match', 20);
          const normalized = businesses.map(business => yelp.normalizeLead(business));
          diagnostics.yelpCount += normalized.length;
          allRawLeads.push(...normalized);
        } catch (error) {
          console.error(`liveSearch yelp error for term "${term}":`, error.message);
        }
      }
    }

    const deduped = dedupeLeads(allRawLeads);

    let ranked;

    if (rawModeEnabled) {
      ranked = deduped
        .map((lead, idx) => {
          if (idx < finalScoreTopN) {
            const scored = scorer.scoreLead(lead);
            const pressure = scoreConnectivityCostPressure(scored, q);
            const live_fit_score = Math.min(
              100,
              Math.round((scored.overall_score * 0.7) + (pressure.score * 0.3))
            );

            return {
              ...scored,
              connectivity_cost_pressure_score: pressure.score,
              connectivity_cost_signals: pressure.matchedSignals,
              live_fit_score,
              scoring_applied: true
            };
          }

          return {
            ...lead,
            connectivity_criticality_score: 0,
            industry_alignment_score: 0,
            service_area_fit_score: 0,
            business_viability_score: 0,
            accessibility_score: 0,
            overall_score: 0,
            connectivity_cost_pressure_score: 0,
            connectivity_cost_signals: [],
            live_fit_score: 0,
            scoring_applied: false
          };
        })
        .filter(lead => {
          if (normalizedState && lead.state && lead.state.toUpperCase() !== normalizedState) return false;
          return true;
        })
        .slice(0, finalLimit);
    } else {
      ranked = deduped
        .map(lead => {
          const scored = scorer.scoreLead(lead);
          const pressure = scoreConnectivityCostPressure(scored, q);
          const live_fit_score = Math.min(
            100,
            Math.round((scored.overall_score * 0.7) + (pressure.score * 0.3))
          );

          return {
            ...scored,
            connectivity_cost_pressure_score: pressure.score,
            connectivity_cost_signals: pressure.matchedSignals,
            live_fit_score,
            scoring_applied: true
          };
        })
        .filter(lead => {
          if (normalizedState && lead.state && lead.state.toUpperCase() !== normalizedState) return false;
          return lead.live_fit_score >= finalMinScore;
        })
        .sort((a, b) => b.live_fit_score - a.live_fit_score)
        .slice(0, finalLimit);
    }

    // Persist live-discovered leads so DB mode can reuse results.
    if (process.env.SUPABASE_SERVICE_KEY) {
      const db = new DatabaseManager();
      for (const lead of ranked) {
        try {
          await db.upsertLead(lead);
          diagnostics.savedCount += 1;
        } catch (error) {
          diagnostics.saveErrors += 1;
          console.error('liveSearch save error:', error.message);
        }
      }
    }

    let results = ranked;

    if (includeContactsEnabled) {
      const supabaseRead = createClient(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
      );

      const sourceIds = ranked.map((lead) => lead.source_id).filter(Boolean);
      if (sourceIds.length > 0) {
        const { data: leadRows, error: leadRowsError } = await supabaseRead
          .from('leads')
          .select('id, source_id, best_contact_confidence, best_contact_source, best_contact_email, best_contact_name')
          .in('source_id', sourceIds);

        if (!leadRowsError && (leadRows || []).length) {
          const leadBySourceId = (leadRows || []).reduce((acc, row) => {
            acc[row.source_id] = row;
            return acc;
          }, {});

          const leadIds = (leadRows || []).map((row) => row.id).filter(Boolean);
          const contactsByLeadId = {};

          if (leadIds.length > 0) {
            const { data: contacts, error: contactsError } = await supabaseRead
              .from('lead_contacts')
              .select('*')
              .in('lead_id', leadIds)
              .gte('confidence_score', finalMinContactConfidence)
              .order('confidence_score', { ascending: false });

            if (!contactsError) {
              for (const contact of contacts || []) {
                if (!contactsByLeadId[contact.lead_id]) contactsByLeadId[contact.lead_id] = [];
                contactsByLeadId[contact.lead_id].push(contact);
              }
            }
          }

          results = ranked.map((lead) => {
            const saved = leadBySourceId[lead.source_id];
            if (!saved) return lead;
            return {
              ...lead,
              best_contact_confidence: saved.best_contact_confidence,
              best_contact_source: saved.best_contact_source,
              best_contact_email: saved.best_contact_email,
              best_contact_name: saved.best_contact_name,
              contacts: contactsByLeadId[saved.id] || []
            };
          });
        }
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        query: q,
        state: normalizedState || null,
        count: results.length,
        results,
        diagnostics
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
