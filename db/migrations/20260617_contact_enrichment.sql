-- Contact enrichment migration for VetElecTech Lead Finder
-- Run in Supabase SQL Editor.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS company_domain TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_company_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS facebook_page_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS indeed_company_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS contacts_enrichment_status VARCHAR(30) DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS contacts_enriched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS best_contact_confidence SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_contact_source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS best_contact_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS best_contact_name VARCHAR(150);

CREATE TABLE IF NOT EXISTS lead_contacts (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  dedupe_key TEXT NOT NULL,
  full_name VARCHAR(150),
  first_name VARCHAR(80),
  last_name VARCHAR(80),
  title VARCHAR(150),
  department VARCHAR(80),
  seniority VARCHAR(80),
  email VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
  email_status VARCHAR(30),
  phone_direct VARCHAR(30),
  linkedin_profile_url VARCHAR(500),
  source_platform VARCHAR(50) NOT NULL,
  source_url VARCHAR(500),
  confidence_score SMALLINT DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 100),
  is_primary BOOLEAN DEFAULT FALSE,
  notes TEXT,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_contacts_dedupe
  ON lead_contacts(lead_id, dedupe_key);

CREATE INDEX IF NOT EXISTS idx_lead_contacts_lead_id
  ON lead_contacts(lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_contacts_email
  ON lead_contacts(email);

CREATE INDEX IF NOT EXISTS idx_lead_contacts_confidence
  ON lead_contacts(confidence_score DESC);

CREATE INDEX IF NOT EXISTS idx_leads_enrichment_status
  ON leads(contacts_enrichment_status);

CREATE INDEX IF NOT EXISTS idx_leads_best_contact_confidence
  ON leads(best_contact_confidence DESC);

CREATE TABLE IF NOT EXISTS enrichment_runs (
  id BIGSERIAL PRIMARY KEY,
  run_type VARCHAR(30) NOT NULL,
  leads_attempted INT DEFAULT 0,
  contacts_created INT DEFAULT 0,
  contacts_updated INT DEFAULT 0,
  errors_count INT DEFAULT 0,
  duration_ms INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
