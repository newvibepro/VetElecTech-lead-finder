/**
 * Demo mode — runs scorer on sample data without API calls or database.
 * Usage: npm run scrape:demo
 */

const ScoringEngine = require('./lib/scorer');

const sampleLeads = [
  {
    name: 'Riverdale Medical Center',
    state: 'TX', zip_code: '76040', city: 'Arlington',
    description: 'hospital emergency 24/7 telemedicine network uptime critical systems',
    categories: ['hospital', 'healthcare'], store_type: 'hospital',
    google_rating: 4.5, google_review_count: 250, website: 'https://example.com', phone: '555-0001'
  },
  {
    name: 'Summit Ridge Manufacturing',
    state: 'GA', zip_code: '30041', city: 'Cumming',
    description: 'manufacturing plant assembly line IoT connected remote rural location backup internet',
    categories: ['manufacturing', 'industrial'], store_type: 'factory',
    google_rating: 4.1, google_review_count: 60, website: 'https://example.com', phone: '555-0002'
  },
  {
    name: 'Bayou Credit Union',
    state: 'LA', zip_code: '70112', city: 'New Orleans',
    description: 'bank financial services credit union multi-location branch network redundancy compliance',
    categories: ['financial', 'bank'], store_type: 'financial',
    google_rating: 4.4, google_review_count: 120, website: 'https://example.com', phone: '555-0003'
  }
];

const scorer = new ScoringEngine();

console.log('\n🎯 VetElecTech Lead Finder — Demo Scoring\n');
console.log('─'.repeat(60));

sampleLeads.forEach((lead, i) => {
  const scored = scorer.scoreLead(lead);
  console.log(`\n#${i + 1} ${scored.name} (${scored.city}, ${scored.state})`);
  console.log(`   Overall Score          : ${scored.overall_score}`);
  console.log(`   Connectivity Criticality: ${scored.connectivity_criticality_score}`);
  console.log(`   Industry Alignment      : ${scored.industry_alignment_score}`);
  console.log(`   Service Area Fit        : ${scored.service_area_fit_score}`);
  console.log(`   Business Viability      : ${scored.business_viability_score}`);
  console.log(`   Accessibility           : ${scored.accessibility_score}`);
});

console.log('\n' + '─'.repeat(60));
console.log('✅ Demo complete. Run `npm run scrape` to pull live data.\n');
