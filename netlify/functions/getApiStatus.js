/**
 * Netlify Function: API Status
 * GET /.netlify/functions/getApiStatus
 *
 * Returns safe booleans indicating whether provider keys are configured.
 */

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const mapsConfigured = Boolean((process.env.GOOGLE_MAPS_API_KEY || '').trim());
    const yelpConfigured = Boolean((process.env.YELP_API_KEY || '').trim());

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        mapsConfigured,
        yelpConfigured,
        liveReady: mapsConfigured || yelpConfigured,
        activeLiveSources: [
          ...(mapsConfigured ? ['maps'] : []),
          ...(yelpConfigured ? ['yelp'] : [])
        ]
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
