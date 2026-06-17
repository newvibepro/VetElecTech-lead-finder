/**
 * Netlify Function: Probe Google Maps Places runtime
 * GET /.netlify/functions/probeMaps?q=pilot%20truck%20stop&state=TX
 */

const GoogleMapsScraper = require('../../scripts/lib/googleMapsScraper');

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
  LA: 'Baton Rouge, LA'
};

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const { q = 'pilot truck stop', state = '' } = event.queryStringParameters || {};
    const key = String(process.env.GOOGLE_MAPS_API_KEY || '').trim();
    const normalizedState = String(state || '').toUpperCase();
    const location = normalizedState ? (STATE_LOCATIONS[normalizedState] || `${normalizedState}, USA`) : 'United States';

    if (!key) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          ok: false,
          error: 'GOOGLE_MAPS_API_KEY missing in runtime environment.',
          keyPresent: false
        })
      };
    }

    const maps = new GoogleMapsScraper(key);

    try {
      const places = await maps.searchBusinesses(String(q).trim(), location);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          keyPresent: true,
          query: q,
          location,
          count: (places || []).length,
          sample: (places || []).slice(0, 5).map((p) => ({
            id: p.id,
            name: p.displayName?.text || p.name || '',
            formattedAddress: p.formattedAddress || ''
          }))
        })
      };
    } catch (error) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          ok: false,
          keyPresent: true,
          query: q,
          location,
          status: error.response?.status || null,
          statusText: error.response?.statusText || null,
          message: error.response?.data?.error?.message || error.message,
          details: error.response?.data || null
        })
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
