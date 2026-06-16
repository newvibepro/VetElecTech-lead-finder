/**
 * Demo Seed Script — VetElecTech Lead Finder
 * Populates the database with realistic sample B2B leads for UI testing.
 * Run with: npm run db:seed
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const sampleLeads = [
  {
    source: 'demo', source_id: 'demo_001',
    name: 'Lone Star Regional Medical Center',
    address: '4500 Medical Dr', city: 'San Antonio', state: 'TX', zip_code: '78229',
    phone: '(210) 555-0100', website: 'https://lonestarmedical.example.com',
    business_type: 'hospital', categories: ['hospital', 'healthcare'],
    description: '24/7 emergency and surgical hospital. Network uptime is mission-critical for patient records and telemedicine.',
    google_rating: 4.4, google_review_count: 312,
    connectivity_criticality_score: 95, industry_alignment_score: 88,
    service_area_fit_score: 72, business_viability_score: 85, accessibility_score: 100,
    overall_score: 88, outreach_status: 'not_contacted'
  },
  {
    source: 'demo', source_id: 'demo_002',
    name: 'Gulf Coast Manufacturing LLC',
    address: '7800 Industrial Blvd', city: 'Houston', state: 'TX', zip_code: '77015',
    phone: '(713) 555-0200', website: 'https://gulfcoastmfg.example.com',
    business_type: 'manufacturing', categories: ['manufacturing', 'industrial'],
    description: 'Metal fabrication plant with IoT-connected CNC machines. Needs backup connectivity for production floor systems.',
    google_rating: 4.1, google_review_count: 58,
    connectivity_criticality_score: 80, industry_alignment_score: 92,
    service_area_fit_score: 78, business_viability_score: 72, accessibility_score: 90,
    overall_score: 82, outreach_status: 'not_contacted'
  },
  {
    source: 'demo', source_id: 'demo_003',
    name: 'Peach State Conference Center',
    address: '1200 Convention Way', city: 'Atlanta', state: 'GA', zip_code: '30303',
    phone: '(404) 555-0300', website: 'https://peachstatecc.example.com',
    business_type: 'conference_center', categories: ['venue', 'hospitality', 'events'],
    description: 'Full-service conference and event venue with AV needs. Requires redundant internet for live-streamed events.',
    google_rating: 4.7, google_review_count: 204,
    connectivity_criticality_score: 72, industry_alignment_score: 85,
    service_area_fit_score: 65, business_viability_score: 90, accessibility_score: 100,
    overall_score: 78, outreach_status: 'not_contacted'
  },
  {
    source: 'demo', source_id: 'demo_004',
    name: 'Blue Ridge Farmers Cooperative',
    address: '320 County Road 14', city: 'Boone', state: 'NC', zip_code: '28607',
    phone: '(828) 555-0400', website: 'https://blueridgecoop.example.com',
    business_type: 'agriculture', categories: ['agriculture', 'rural', 'cooperative'],
    description: 'Rural farm cooperative managing precision ag equipment and grain systems. Fiber internet unavailable at location.',
    google_rating: 4.2, google_review_count: 31,
    connectivity_criticality_score: 68, industry_alignment_score: 78,
    service_area_fit_score: 95, business_viability_score: 60, accessibility_score: 80,
    overall_score: 76, outreach_status: 'not_contacted'
  },
  {
    source: 'demo', source_id: 'demo_005',
    name: 'Volunteer State Credit Union',
    address: '890 Main Street', city: 'Nashville', state: 'TN', zip_code: '37201',
    phone: '(615) 555-0500', website: 'https://volunteercu.example.com',
    business_type: 'financial', categories: ['bank', 'credit_union', 'financial_services'],
    description: 'Community credit union with 6 branch locations. Regulatory compliance requires 99.9% uptime for transaction systems.',
    google_rating: 4.5, google_review_count: 187,
    connectivity_criticality_score: 92, industry_alignment_score: 80,
    service_area_fit_score: 70, business_viability_score: 88, accessibility_score: 100,
    overall_score: 86, outreach_status: 'not_contacted'
  },
  {
    source: 'demo', source_id: 'demo_006',
    name: 'OKC Public School District IT Dept',
    address: '900 N Klein Ave', city: 'Oklahoma City', state: 'OK', zip_code: '73106',
    phone: '(405) 555-0600', website: 'https://okcps.example.com',
    business_type: 'government_education', categories: ['school', 'government', 'education'],
    description: 'District managing 42 school campuses. Network redundancy needed for standardized testing and SIS systems.',
    google_rating: 3.8, google_review_count: 95,
    connectivity_criticality_score: 75, industry_alignment_score: 82,
    service_area_fit_score: 80, business_viability_score: 70, accessibility_score: 90,
    overall_score: 77, outreach_status: 'not_contacted'
  },
  {
    source: 'demo', source_id: 'demo_007',
    name: 'Magnolia Logistics & Distribution',
    address: '3400 Warehouse Row', city: 'Jackson', state: 'MS', zip_code: '39209',
    phone: '(601) 555-0700', website: 'https://magnoliadist.example.com',
    business_type: 'logistics', categories: ['warehouse', 'logistics', 'distribution'],
    description: 'Regional distribution center with real-time inventory tracking. WMS connectivity is critical to daily operations.',
    google_rating: 4.0, google_review_count: 44,
    connectivity_criticality_score: 78, industry_alignment_score: 88,
    service_area_fit_score: 85, business_viability_score: 65, accessibility_score: 85,
    overall_score: 80, outreach_status: 'not_contacted'
  },
  {
    source: 'demo', source_id: 'demo_008',
    name: 'Frontier Construction Group',
    address: '1100 Builder Blvd', city: 'Tulsa', state: 'OK', zip_code: '74103',
    phone: '(918) 555-0800', website: 'https://frontierconst.example.com',
    business_type: 'construction', categories: ['construction', 'contractor', 'remote_site'],
    description: 'Commercial construction company operating remote job sites statewide. Needs reliable field connectivity for BIM and project management.',
    google_rating: 4.3, google_review_count: 72,
    connectivity_criticality_score: 65, industry_alignment_score: 75,
    service_area_fit_score: 88, business_viability_score: 75, accessibility_score: 90,
    overall_score: 74, outreach_status: 'not_contacted'
  }
];

async function seedDatabase() {
  console.log('🌱 Seeding VetElecTech Lead Finder with sample leads...');
  const now = new Date().toISOString();

  const prepared = sampleLeads.map(lead => ({
    ...lead,
    last_updated_at: now,
    last_scraped_at: now,
    created_at: now
  }));

  const { data, error } = await supabase
    .from('leads')
    .upsert(prepared, { onConflict: 'source_id' });

  if (error) {
    console.error('❌ Seed error:', error.message);
    process.exit(1);
  }

  console.log(`✅ Seeded ${sampleLeads.length} sample leads successfully.`);
}

seedDatabase();
