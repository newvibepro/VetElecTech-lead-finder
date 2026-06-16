/**
 * Yelp API Scraper
 * Searches for B2B businesses needing Starlink backup network solutions
 */

const axios = require('axios');

// Yelp categories that map to target B2B industries
const TARGET_YELP_CATEGORIES = [
  'manufacturers', 'wholesale', 'warehouses', 'industrialequipment',
  'hotels', 'resorts', 'eventplanning', 'venues',
  'hospitals', 'medcenters', 'physiciansnurses', 'dentists',
  'banks', 'financialadvising', 'insurance',
  'contractors', 'generativecontractors', 'electricians',
  'publicschools', 'universities', 'adulteduc',
  'government'
].join(',');

class YelpScraper {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.yelp.com/v3';
  }

  /**
   * Search businesses on Yelp
   */
  async searchBusinesses(term, location, sort_by = 'rating', limit = 50) {
    try {
      const response = await axios.get(`${this.baseUrl}/businesses/search`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`
        },
        params: {
          term,
          location,
          sort_by,
          limit,
          categories: TARGET_YELP_CATEGORIES
        }
      });

      return response.data.businesses || [];
    } catch (error) {
      console.error('❌ Yelp search error:', error.message);
      throw error;
    }
  }

  /**
   * Get business details
   */
  async getBusinessDetails(businessId) {
    try {
      const response = await axios.get(`${this.baseUrl}/businesses/${businessId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Yelp business details error:', error.message);
      throw error;
    }
  }

  /**
   * Get reviews for a business
   */
  async getBusinessReviews(businessId, limit = 20) {
    try {
      const response = await axios.get(`${this.baseUrl}/businesses/${businessId}/reviews`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        params: { limit, sort_by: 'newest' }
      });
      return response.data.reviews || [];
    } catch (error) {
      console.error('❌ Yelp reviews error:', error.message);
      return [];
    }
  }

  /**
   * Normalize Yelp business into leads schema
   */
  normalizeLead(business, reviews = []) {
    const reviewText = reviews.map(r => r.text).join(' ').toLowerCase();

    return {
      source: 'yelp',
      source_id: business.id,
      name: business.name,
      address: business.location?.address1 || '',
      city: business.location?.city || '',
      state: business.location?.state || '',
      zip_code: business.location?.zip_code || '',
      latitude: business.coordinates?.latitude || null,
      longitude: business.coordinates?.longitude || null,
      phone: business.phone || null,
      website: business.website || null,
      yelp_url: business.url || null,
      yelp_rating: business.rating || 0,
      yelp_review_count: business.review_count || 0,
      store_type: business.categories?.[0]?.title || '',
      categories: business.categories?.map(c => c.alias) || [],
      description: reviewText.substring(0, 500),
      keywords: this.extractKeywords(business, reviewText)
    };
  }

  /**
   * Extract relevant keywords from business data and review text
   */
  extractKeywords(business, reviewText) {
    const keywords = [];

    if (business.categories) {
      keywords.push(...business.categories.slice(0, 4).map(c => c.alias));
    }

    const networkSignals = [
      'network', 'internet', 'wifi', 'connectivity', 'backup', 'remote',
      'satellite', 'starlink', 'uptime', 'server', 'it'
    ];
    networkSignals.forEach(kw => {
      if (reviewText.includes(kw)) keywords.push(kw);
    });

    return [...new Set(keywords)];
  }

  formatHours(hours) {
    if (!hours?.[0]?.open) return '';
    return hours[0].open.map(h => `${h.day}: ${h.start}-${h.end}`).join(', ');
  }
}

module.exports = YelpScraper;
