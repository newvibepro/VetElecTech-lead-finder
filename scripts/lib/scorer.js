/**
 * Scoring Engine for VetElecTech Lead Finder
 * Scores B2B businesses by their fit as Starlink backup network customers.
 *
 * Scoring Dimensions:
 *   - Connectivity Criticality (35%): How critical is uptime to their operations
 *   - Industry Alignment      (25%): How well does their industry fit Starlink backup use cases
 *   - Service Area Fit        (20%): Geographic suitability (rural, underserved, outage-prone)
 *   - Business Viability      (15%): Size and reputation signals — capacity to invest
 *   - Accessibility           ( 5%): Contactable, has website/phone
 */

// Industries where network downtime = direct revenue/safety loss
const HIGH_CRITICALITY_KEYWORDS = [
  'hospital', 'medical center', 'clinic', 'healthcare', 'surgery', 'urgent care',
  'emergency', 'ems', 'fire station', 'police', '911', 'dispatch',
  'bank', 'credit union', 'financial', 'insurance', 'trading', 'brokerage',
  'data center', 'colocation', 'cloud', 'server farm',
  'airport', 'transportation', 'logistics hub', 'port', 'rail',
  'utility', 'power plant', 'water treatment', 'grid', 'energy'
];

// Industries with strong Starlink backup network alignment
const INDUSTRY_ALIGNMENT_KEYWORDS = [
  'manufacturing', 'factory', 'plant', 'assembly', 'industrial', 'fabrication',
  'warehouse', 'distribution center', 'fulfillment', 'supply chain',
  'hotel', 'resort', 'motel', 'inn', 'conference center', 'event venue', 'casino',
  'school', 'university', 'campus', 'college', 'academy', 'training center',
  'government', 'municipal', 'county', 'city hall', 'courthouse',
  'construction', 'contractor', 'job site', 'field office', 'remote site',
  'agriculture', 'farm', 'ranch', 'rural', 'agribusiness',
  'retail chain', 'franchise', 'multi-location', 'pos system',
  'mining', 'oil', 'gas', 'refinery', 'drilling', 'offshore'
];

// Signals that a business has poor primary connectivity — ideal Starlink target
const CONNECTIVITY_NEED_KEYWORDS = [
  'remote', 'rural', 'off-grid', 'satellite', 'backup', 'redundancy',
  'failover', 'outage', 'connectivity', 'internet issues', 'unreliable',
  'fiber unavailable', 'no cable', 'business continuity', 'disaster recovery',
  'network uptime', 'always-on', '24/7 operations', 'critical systems'
];

// Keywords indicating business has contactable digital presence
const ACCESSIBILITY_KEYWORDS = [
  'website', 'online', 'email', 'contact us', 'request a quote', 'schedule'
];

class ScoringEngine {
  constructor(weights = {}) {
    this.weights = {
      connectivityCriticality: parseFloat(process.env.SCORE_CRITICALITY || 35),
      industryAlignment: parseFloat(process.env.SCORE_INDUSTRY || 25),
      serviceAreaFit: parseFloat(process.env.SCORE_AREA || 20),
      businessViability: parseFloat(process.env.SCORE_VIABILITY || 15),
      accessibility: parseFloat(process.env.SCORE_ACCESSIBILITY || 5),
      ...weights
    };

    const totalWeight = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      console.warn(`⚠️  Weights sum to ${totalWeight}, not 100`);
    }
  }

  /**
   * Connectivity Criticality Score (0–100)
   * How badly does this business need reliable, always-on connectivity?
   */
  calculateConnectivityCriticalityScore(lead) {
    let score = 0;

    const text = [
      lead.description || '',
      lead.keywords?.join(' ') || '',
      lead.categories?.join(' ') || '',
      lead.store_type || '',
      lead.name || ''
    ].join(' ').toLowerCase();

    // High-criticality industry match
    const criticalMatches = HIGH_CRITICALITY_KEYWORDS.filter(kw => text.includes(kw)).length;
    score += Math.min(criticalMatches * 15, 50);

    // Explicit connectivity need signals
    const needMatches = CONNECTIVITY_NEED_KEYWORDS.filter(kw => text.includes(kw)).length;
    score += Math.min(needMatches * 10, 30);

    // Multi-location businesses have higher criticality
    if (text.includes('multi') || text.includes('branch') || text.includes('chain') || text.includes('locations')) {
      score += 15;
    }

    // 24/7 operations signal
    if (text.includes('24') || text.includes('round the clock') || text.includes('always open')) {
      score += 10;
    }

    return Math.min(Math.round(score), 100);
  }

  /**
   * Industry Alignment Score (0–100)
   * How well does this industry match AV/network installation + Starlink use cases?
   */
  calculateIndustryAlignmentScore(lead) {
    let score = 0;

    const text = [
      lead.description || '',
      lead.keywords?.join(' ') || '',
      lead.categories?.join(' ') || '',
      lead.store_type || '',
      lead.name || ''
    ].join(' ').toLowerCase();

    const alignmentMatches = INDUSTRY_ALIGNMENT_KEYWORDS.filter(kw => text.includes(kw)).length;
    if (alignmentMatches === 0) return 0; // Must be an aligned industry

    score += Math.min(alignmentMatches * 12, 50);

    // AV / audio-visual / presentation tech already in play → upsell opportunity
    if (text.includes('av') || text.includes('audio visual') || text.includes('conference room') ||
        text.includes('presentation') || text.includes('projector') || text.includes('display')) {
      score += 25;
    }

    // Network infrastructure signals
    if (text.includes('network') || text.includes('it department') || text.includes('server') ||
        text.includes('wifi') || text.includes('wireless') || text.includes('infrastructure')) {
      score += 20;
    }

    // Bonus: directly mentions Starlink or satellite internet
    if (text.includes('starlink') || text.includes('satellite internet') || text.includes('spacex')) {
      score += 15;
    }

    return Math.min(Math.round(score), 100);
  }

  /**
   * Service Area Fit Score (0–100)
   * Geographic value: rural, semi-rural, or underserved areas benefit most from Starlink.
   */
  calculateServiceAreaFitScore(lead) {
    let score = 0;

    // Base score: target states VetElecTech serves
    const targetStates = ['TX', 'FL', 'GA', 'NC', 'VA', 'TN', 'AL', 'SC', 'LA', 'MS',
                          'OK', 'AR', 'KY', 'WV', 'MT', 'ID', 'WY', 'ND', 'SD', 'NE'];
    if (targetStates.includes(lead.state)) {
      score += 30;
    } else if (lead.state) {
      score += 15; // Any US state gets some score
    }

    // Rural zip code prefix heuristic
    const zip = parseInt(lead.zip_code?.substring(0, 3) || 0);
    // Rural ranges: high plains, south, mountain west
    const ruralRanges = [[730, 749], [350, 399], [570, 577], [580, 588], [590, 599],
                         [820, 831], [835, 838]];
    const isRural = ruralRanges.some(([lo, hi]) => zip >= lo && zip <= hi);
    if (isRural) score += 25;

    // Lat/lng — continental US with rural bias (lat 30–45, exclude coastal metros)
    if (lead.latitude && lead.longitude) {
      const lat = parseFloat(lead.latitude);
      const lng = parseFloat(lead.longitude);
      if (lat >= 25 && lat <= 50 && lng >= -125 && lng <= -65) {
        score += 15; // Valid continental US
        // Interior / less-served areas
        if (lng >= -105 && lng <= -80) score += 10;
      }
    }

    // Proximity clustering bonus (multiple leads in same area = service route efficiency)
    score += 10;

    return Math.min(Math.round(score), 100);
  }

  /**
   * Business Viability Score (0–100)
   * Does this business have the size and reputation to invest in Starlink infrastructure?
   */
  calculateBusinessViabilityScore(lead) {
    let score = 0;

    // Google reviews — higher rating + count = more established business
    if (lead.google_review_count > 100) {
      score += 25;
    } else if (lead.google_review_count > 20) {
      score += 15;
    } else if (lead.google_review_count > 0) {
      score += 8;
    }

    if (lead.google_rating >= 4.0) {
      score += 20;
    } else if (lead.google_rating >= 3.5) {
      score += 10;
    }

    // Yelp signals
    if (lead.yelp_review_count > 50) {
      score += 20;
    } else if (lead.yelp_review_count > 10) {
      score += 10;
    }

    if (lead.yelp_rating >= 4.0) {
      score += 15;
    } else if (lead.yelp_rating >= 3.5) {
      score += 8;
    }

    // Has website — signal of established business
    if (lead.website) score += 10;

    // Has phone
    if (lead.phone) score += 5;

    // Multi-location signals
    const text = (lead.description || '').toLowerCase();
    if (text.includes('corporate') || text.includes('enterprise') || text.includes('headquarters')) {
      score += 10;
    }

    return Math.min(Math.round(score), 100);
  }

  /**
   * Accessibility Score (0–100)
   * Can VetElecTech reach this lead easily?
   */
  calculateAccessibilityScore(lead) {
    let score = 0;
    if (lead.website) score += 40;
    if (lead.phone) score += 35;
    if (lead.address) score += 15;
    if (lead.google_maps_url || lead.yelp_url) score += 10;
    return Math.min(Math.round(score), 100);
  }

  /**
   * Calculate final weighted overall score for a lead
   */
  calculateOverallScore(lead) {
    const scores = {
      connectivity_criticality_score: this.calculateConnectivityCriticalityScore(lead),
      industry_alignment_score: this.calculateIndustryAlignmentScore(lead),
      service_area_fit_score: this.calculateServiceAreaFitScore(lead),
      business_viability_score: this.calculateBusinessViabilityScore(lead),
      accessibility_score: this.calculateAccessibilityScore(lead)
    };

    const overall = Math.round(
      (scores.connectivity_criticality_score * this.weights.connectivityCriticality +
       scores.industry_alignment_score      * this.weights.industryAlignment +
       scores.service_area_fit_score        * this.weights.serviceAreaFit +
       scores.business_viability_score      * this.weights.businessViability +
       scores.accessibility_score           * this.weights.accessibility) / 100
    );

    return { ...scores, overall_score: Math.min(overall, 100) };
  }

  /**
   * Score and annotate a lead object in place
   */
  scoreLead(lead) {
    const scores = this.calculateOverallScore(lead);
    return { ...lead, ...scores };
  }
}

module.exports = ScoringEngine;
