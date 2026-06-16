/**
 * Google Maps API Scraper
 * Searches for B2B businesses that need Starlink backup network solutions.
 */

const axios = require('axios');

class GoogleMapsScraper {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://places.googleapis.com/v1';
    this.fieldMask = [
      'places.id',
      'places.name',
      'places.displayName',
      'places.formattedAddress',
      'places.location',
      'places.types',
      'places.primaryType',
      'places.googleMapsUri',
      'places.rating',
      'places.userRatingCount',
      'places.websiteUri',
      'places.nationalPhoneNumber',
      'places.regularOpeningHours',
      'places.editorialSummary'
    ].join(',');
  }

  /**
   * Search for businesses by query and location
   */
  async searchBusinesses(query, location, radius = 50000) {
    try {
      const response = await axios.post(`${this.baseUrl}/places:searchText`, {
        textQuery: `${query} in ${location}`,
        pageSize: 20,
        strictTypeFiltering: false
      }, {
        headers: {
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': this.fieldMask,
          'Content-Type': 'application/json'
        }
      });

      return response.data.places || [];
    } catch (error) {
      const apiMessage = error.response?.data?.error?.message;
      const apiStatus = error.response?.data?.error?.status;
      console.error(
        `❌ Google Maps search error: ${apiStatus || error.message}${apiMessage ? ` — ${apiMessage}` : ''}`
      );
      throw error;
    }
  }

  /**
   * Get detailed place information
   */
  async getPlaceDetails(placeId) {
    try {
      const response = await axios.get(`${this.baseUrl}/places/${placeId}`, {
        headers: {
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': [
            'id', 'name', 'displayName', 'formattedAddress', 'location',
            'types', 'primaryType', 'googleMapsUri', 'rating', 'userRatingCount',
            'websiteUri', 'nationalPhoneNumber', 'regularOpeningHours', 'editorialSummary'
          ].join(',')
        }
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Place details error for ${placeId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Normalize a Google Maps place into the leads schema
   */
  normalizeLead(place) {
    const address = place.formattedAddress || '';
    const addressParts = address.split(', ');
    const stateZip = addressParts[addressParts.length - 2] || '';
    const [state, zip] = stateZip.split(' ');

    return {
      source: 'google_maps',
      source_id: `gm_${place.id}`,
      name: place.displayName?.text || place.name || 'Unknown',
      address,
      city: addressParts[addressParts.length - 3] || '',
      state: state || '',
      zip_code: zip || '',
      latitude: place.location?.latitude,
      longitude: place.location?.longitude,
      phone: place.nationalPhoneNumber || '',
      website: place.websiteUri || '',
      google_maps_url: place.googleMapsUri || '',
      google_rating: place.rating || null,
      google_review_count: place.userRatingCount || 0,
      description: place.editorialSummary?.text || '',
      categories: place.types || [],
      store_type: place.primaryType || '',
      keywords: []
    };
  }
}

module.exports = GoogleMapsScraper;
