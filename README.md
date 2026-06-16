# VetElecTech Lead Finder

**Automated B2B lead discovery platform for VetElecTech.com**
Find businesses that need Starlink backup network solutions for systems integrity.

![Stack](https://img.shields.io/badge/Stack-Node%20%7C%20React%20%7C%20Supabase%20%7C%20Netlify-0f2044?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-c9a227?style=flat-square)

---

## What It Does

VetElecTech Lead Finder scrapes Google Maps and Yelp to discover B2B businesses that are strong candidates for Starlink backup network installation. Each lead is scored across five dimensions:

| Dimension | Weight | Description |
|---|---|---|
| Connectivity Criticality | 35% | How critical is uptime to their operations (hospitals, banks, factories) |
| Industry Alignment | 25% | How well does their industry fit AV/network installation use cases |
| Service Area Fit | 20% | Geographic suitability — rural and underserved areas benefit most |
| Business Viability | 15% | Size and reputation signals — capacity to invest |
| Accessibility | 5% | Has website, phone, and contactable presence |

---

## Target Industries

- Hospitals & Medical Centers
- Manufacturing Plants & Warehouses
- Hotels, Resorts & Conference Centers
- Banks & Financial Services Offices
- Schools, Universities & Campuses
- Government & Municipal Offices
- Construction Companies (remote job sites)
- Agriculture / Rural Businesses
- Logistics & Distribution Centers
- Data Centers & IT Companies

---

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/YOUR_USERNAME/vetelectech-lead-finder.git
cd vetelectech-lead-finder
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Set up Supabase database
npm run db:setup
# Copy the printed SQL into your Supabase SQL Editor

# 4. Seed with sample data for testing
npm run db:seed

# 5. Run the scraper (safe mode first)
SAFE_MODE=1 npm run scrape

# 6. Start the dev server
npm run dev
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_URL` | Same URL (exposed to frontend) |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_SUPABASE_ANON_KEY` | Same key (exposed to frontend) |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (scraper only, never expose) |
| `GOOGLE_MAPS_API_KEY` | Google Places API v2 key |
| `YELP_API_KEY` | Yelp Fusion API key |
| `TARGET_STATES` | Comma-separated state codes (default: TX,FL,GA,NC,TN,VA,AL,SC,OK,LA) |
| `SAFE_MODE` | Set to `1` to limit API calls during testing |

---

## Scraper Commands

```bash
npm run scrape            # Scrape all sources
npm run scrape:maps       # Google Maps only
npm run scrape:yelp       # Yelp only
npm run scrape:demo       # Demo mode (no API calls)
npm run db:setup          # Print SQL schema to set up Supabase
npm run db:seed           # Seed 8 sample leads for testing
```

---

## Netlify Deployment

1. Push this repo to GitHub
2. Log in to [Netlify](https://netlify.com) → **Add new site** → **Import from Git**
3. Build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`
4. Add all environment variables from `.env.example` under **Site settings → Environment variables**
5. Deploy

---

## Architecture

```
Frontend (React + Vite)
  └── Dashboard, LeadList, LeadMap, StatsPanel
        ↓ fetch
Netlify Functions (Node.js)
  ├── getTopLeads
  ├── searchLeads
  └── getStats
        ↓ Supabase client
Supabase (PostgreSQL)
  └── leads table, scraper_runs table

Scraper (Node CLI — run locally or on schedule)
  ├── Google Maps API
  ├── Yelp Fusion API
  └── ScoringEngine → DatabaseManager
```

---

## License

MIT — VetElecTech.com
