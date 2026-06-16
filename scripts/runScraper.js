/**
 * Main Scraper Runner — VetElecTech Lead Finder
 * Finds B2B businesses needing Starlink backup network solutions.
 * Usage: node scripts/runScraper.js [--source maps|yelp|all]
 */

require('dotenv').config();
const ScoringEngine = require('./lib/scorer');
const DatabaseManager = require('./lib/db');
const GoogleMapsScraper = require('./lib/googleMapsScraper');
const YelpScraper = require('./lib/yelpScraper');

// CLI args
const args = process.argv.slice(2);
const sourceArg = args.includes('--source')
  ? args[args.indexOf('--source') + 1]
  : 'all';

const isTruthy = (value) => /^(1|true|yes|on)$/i.test(String(value || '').trim());
const toPositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const SAFE_MODE           = isTruthy(process.env.SAFE_MODE);
const SAFE_MODE_MAX_STATES   = toPositiveInt(process.env.SAFE_MODE_MAX_STATES, 1);
const SAFE_MODE_MAX_QUERIES  = toPositiveInt(process.env.SAFE_MODE_MAX_QUERIES, 2);
const SAFE_MODE_MAX_RESULTS  = toPositiveInt(process.env.SAFE_MODE_MAX_RESULTS, 20);

const parseStateList = (value, fallback = '') =>
  (value || fallback).split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

// Default target states — southern/rural states where Starlink adds most value
const TARGET_STATES  = parseStateList(process.env.TARGET_STATES, 'TX,FL,GA,NC,TN,VA,AL,SC,OK,LA');
const SCRAPE_STATES  = parseStateList(process.env.SCRAPE_STATES);
const ACTIVE_STATES  = SCRAPE_STATES.length > 0 ? SCRAPE_STATES : TARGET_STATES;

// B2B search queries targeting Starlink backup network prospects
const SEARCH_QUERIES = [
  'hospital medical center clinic network systems',
  'manufacturing plant warehouse industrial facility',
  'hotel resort conference center av systems',
  'bank credit union financial services office',
  'school university campus network infrastructure',
  'government municipal county office',
  'construction contractor remote job site',
  'rural business agriculture ranch network',
  'data center server colocation facility',
  'logistics warehouse distribution center',
  'multi-location retail franchise chain'
];

const LOCATION_COORDS = {
  'TX': { lat: 30.2672, lng: -97.7431, name: 'Austin, TX' },
  'FL': { lat: 27.9944, lng: -81.7603, name: 'Orlando, FL' },
  'GA': { lat: 33.7490, lng: -84.3880, name: 'Atlanta, GA' },
  'NC': { lat: 35.7796, lng: -78.6382, name: 'Raleigh, NC' },
  'TN': { lat: 36.1627, lng: -86.7816, name: 'Nashville, TN' },
  'VA': { lat: 37.5407, lng: -77.4360, name: 'Richmond, VA' },
  'AL': { lat: 32.3792, lng: -86.3077, name: 'Montgomery, AL' },
  'SC': { lat: 34.0007, lng: -81.0348, name: 'Columbia, SC' },
  'OK': { lat: 35.4676, lng: -97.5164, name: 'Oklahoma City, OK' },
  'LA': { lat: 30.4515, lng: -91.1871, name: 'Baton Rouge, LA' },
  'CA': { lat: 36.7783, lng: -119.4179, name: 'Fresno, CA' },
  'NY': { lat: 43.0481, lng: -76.1474, name: 'Syracuse, NY' },
  'MT': { lat: 46.8797, lng: -110.3626, name: 'Helena, MT' },
  'WY': { lat: 43.0760, lng: -107.2903, name: 'Casper, WY' },
  'ND': { lat: 46.8083, lng: -100.7837, name: 'Bismarck, ND' }
};

class ScraperOrchestrator {
  constructor() {
    this.scorer   = new ScoringEngine();
    this.googleMaps = new GoogleMapsScraper(process.env.GOOGLE_MAPS_API_KEY);
    this.yelp     = new YelpScraper(process.env.YELP_API_KEY);
    this.db       = new DatabaseManager();
    this.results  = { leads: [], errors: [], summary: {} };
  }

  async run(source = 'all') {
    console.log('🚀 VetElecTech Lead Finder — Starting scrape');
    console.log(`📡 Source: ${source}`);
    console.log(`🎯 Target states: ${ACTIVE_STATES.join(', ')}\n`);
    if (SAFE_MODE) {
      console.log(`🛡️  SAFE_MODE: max_states=${SAFE_MODE_MAX_STATES}, max_queries=${SAFE_MODE_MAX_QUERIES}, max_results=${SAFE_MODE_MAX_RESULTS}\n`);
    }

    const startTime = Date.now();

    try {
      if (source === 'all' || source === 'maps') await this.scrapeGoogleMaps();
      if (source === 'all' || source === 'yelp') await this.scrapeYelp();

      console.log('\n📊 Scoring leads...');
      this.results.leads = this.results.leads.map(lead => this.scorer.scoreLead(lead));

      console.log('\n💾 Saving to database...');
      await this.saveLeads();

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.printSummary(elapsed);
    } catch (error) {
      console.error('❌ Scraper failed:', error.message);
      process.exit(1);
    }
  }

  async scrapeGoogleMaps() {
    console.log('🗺️  Scraping Google Maps...');
    const states = SAFE_MODE ? ACTIVE_STATES.slice(0, SAFE_MODE_MAX_STATES) : ACTIVE_STATES;
    const queries = SAFE_MODE ? SEARCH_QUERIES.slice(0, SAFE_MODE_MAX_QUERIES) : SEARCH_QUERIES;

    for (const state of states) {
      const location = LOCATION_COORDS[state];
      if (!location) continue;

      for (const query of queries) {
        try {
          console.log(`  🔍 "${query}" → ${location.name}`);
          const places = await this.googleMaps.searchBusinesses(query, location.name);
          const limited = SAFE_MODE ? places.slice(0, SAFE_MODE_MAX_RESULTS) : places;
          const normalized = limited.map(p => this.googleMaps.normalizeLead(p));
          this.results.leads.push(...normalized);
          console.log(`     ✅ ${normalized.length} results`);
          await this.sleep(300);
        } catch (err) {
          console.error(`     ❌ Error: ${err.message}`);
          this.results.errors.push({ query, state, error: err.message });
        }
      }
    }
  }

  async scrapeYelp() {
    console.log('⭐ Scraping Yelp...');
    const states = SAFE_MODE ? ACTIVE_STATES.slice(0, SAFE_MODE_MAX_STATES) : ACTIVE_STATES;
    const queries = SAFE_MODE ? SEARCH_QUERIES.slice(0, SAFE_MODE_MAX_QUERIES) : SEARCH_QUERIES;

    for (const state of states) {
      const location = LOCATION_COORDS[state];
      if (!location) continue;

      for (const query of queries) {
        try {
          console.log(`  🔍 "${query}" → ${location.name}`);
          const businesses = await this.yelp.searchBusinesses(query, location.name, 'rating', 20);
          const limited = SAFE_MODE ? businesses.slice(0, SAFE_MODE_MAX_RESULTS) : businesses;
          const normalized = limited.map(b => this.yelp.normalizeLead(b));
          this.results.leads.push(...normalized);
          console.log(`     ✅ ${normalized.length} results`);
          await this.sleep(500);
        } catch (err) {
          console.error(`     ❌ Error: ${err.message}`);
          this.results.errors.push({ query, state, error: err.message });
        }
      }
    }
  }

  async saveLeads() {
    const db = this.db;
    let saved = 0;
    let failed = 0;
    for (const lead of this.results.leads) {
      try {
        await db.upsertLead(lead);
        saved++;
      } catch {
        failed++;
      }
    }
    this.results.summary = { saved, failed, total: this.results.leads.length };
  }

  printSummary(elapsed) {
    const { saved, failed, total } = this.results.summary;
    console.log('\n' + '─'.repeat(50));
    console.log('✅ VetElecTech Lead Finder — Scrape Complete');
    console.log(`   Total leads found : ${total}`);
    console.log(`   Saved to database : ${saved}`);
    console.log(`   Errors            : ${this.results.errors.length + failed}`);
    console.log(`   Time elapsed      : ${elapsed}s`);
    console.log('─'.repeat(50));
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const orchestrator = new ScraperOrchestrator();
orchestrator.run(sourceArg);
