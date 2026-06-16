/**
 * Database Schema Setup — VetElecTech Lead Finder
 * Run with: npm run db:setup
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const schema = `
-- Leads table: B2B businesses that need Starlink backup network
CREATE TABLE IF NOT EXISTS leads (
  id BIGSERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  source_id VARCHAR(255) UNIQUE,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(10),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  phone VARCHAR(20),
  website VARCHAR(500),
  google_maps_url VARCHAR(500),
  yelp_url VARCHAR(500),

  -- Scoring Dimensions
  connectivity_criticality_score SMALLINT DEFAULT 0,
  industry_alignment_score       SMALLINT DEFAULT 0,
  service_area_fit_score         SMALLINT DEFAULT 0,
  business_viability_score       SMALLINT DEFAULT 0,
  accessibility_score            SMALLINT DEFAULT 0,
  overall_score                  SMALLINT DEFAULT 0,

  -- Business Details
  business_type VARCHAR(100),
  categories TEXT[],
  description TEXT,
  keywords TEXT[],

  -- Review Metrics
  yelp_rating DECIMAL(3, 1),
  yelp_review_count INT DEFAULT 0,
  google_rating DECIMAL(3, 1),
  google_review_count INT DEFAULT 0,

  -- Outreach Tracking
  outreach_status VARCHAR(50) DEFAULT 'not_contacted',
  outreach_notes TEXT,
  last_contacted_at TIMESTAMPTZ,

  -- Metadata
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scraper run log
CREATE TABLE IF NOT EXISTS scraper_runs (
  id BIGSERIAL PRIMARY KEY,
  source VARCHAR(50),
  leads_found INT DEFAULT 0,
  leads_saved INT DEFAULT 0,
  errors_count INT DEFAULT 0,
  duration_ms INT DEFAULT 0,
  run_at TIMESTAMPTZ DEFAULT NOW()
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_leads_overall_score ON leads(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_state ON leads(state);
CREATE INDEX IF NOT EXISTS idx_leads_business_type ON leads(business_type);
CREATE INDEX IF NOT EXISTS idx_leads_outreach_status ON leads(outreach_status);
`;

async function setupDatabase() {
  console.log('🛠️  Setting up VetElecTech Lead Finder database...');
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: schema });
    if (error) {
      console.log('Note: exec_sql RPC may not exist. Run the SQL above directly in Supabase SQL Editor.');
      console.log('\nSQL to run in Supabase:\n');
      console.log(schema);
    } else {
      console.log('✅ Database schema created successfully.');
    }
  } catch {
    console.log('📋 Copy and run this SQL in your Supabase SQL Editor:\n');
    console.log(schema);
  }
}

setupDatabase();
