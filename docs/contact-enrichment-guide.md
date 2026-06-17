# Contact Enrichment Guide

This guide covers database migration, API usage, UI workflow, and Netlify configuration for contact enrichment.

## 1) Apply database migration

Run the SQL in:

- `db/migrations/20260617_contact_enrichment.sql`

Paste it into Supabase SQL Editor and execute it once.

## 2) Add environment variables

Set these in local `.env` and in Netlify Site Settings -> Environment Variables.

Required:

- `CONTACT_ENRICHMENT_ENABLED=true`
- `CONTACT_ENRICH_PROVIDER=custom`
- `CONTACT_ENRICH_API_KEY=your-contact-enrichment-api-key`
- `CONTACT_ENRICH_API_BASE_URL=https://your-enrichment-provider.example.com`
- `CONTACT_ENRICH_TIMEOUT_MS=12000`
- `CONTACT_ENRICH_MAX_CONTACTS_PER_LEAD=5`
- `CONTACT_ENRICH_MIN_CONFIDENCE=55`

Website fallback crawler:

- `CONTACT_WEBSITE_CRAWL_ENABLED=true`
- `CONTACT_WEBSITE_CRAWL_MAX_PAGES=6`
- `CONTACT_WEBSITE_CRAWL_TIMEOUT_MS=8000`
- `CONTACT_WEBSITE_CRAWL_USER_AGENT=VetElecTechLeadFinderBot/1.0`

Batch controls:

- `CONTACT_RATE_LIMIT_PER_MIN=45`
- `CONTACT_BATCH_SIZE=15`
- `CONTACT_BATCH_MAX_LEADS=150`

Optional profile URL toggles:

- `CONTACT_INCLUDE_LINKEDIN_COMPANY=true`
- `CONTACT_INCLUDE_FACEBOOK_PAGE=true`
- `CONTACT_INCLUDE_INDEED_COMPANY=true`

## 3) New Netlify functions

### Enrich one lead

- Endpoint: `POST /.netlify/functions/enrichLeadContacts`
- Body:

```json
{
  "leadId": 123
}
```

### Batch enrichment

- Endpoint: `POST /.netlify/functions/batchEnrichContacts`
- Body:

```json
{
  "leadIds": [1, 2, 3],
  "onlyMissing": false
}
```

Alternative GET mode:

- `/.netlify/functions/batchEnrichContacts?limit=50&state=TX&minScore=60&onlyMissing=1`

### Read contacts for a lead

- Endpoint: `GET /.netlify/functions/getLeadContacts?leadId=123&minConfidence=60`

## 4) Search endpoints with contacts

These existing endpoints now support contact embedding:

- `/.netlify/functions/getTopLeads?includeContacts=1&minContactConfidence=60`
- `/.netlify/functions/searchLeads?q=hospital&includeContacts=1&minContactConfidence=60`
- `/.netlify/functions/liveSearch?q=clinic&includeContacts=1&minContactConfidence=60`

When `includeContacts=1`, each lead can include a `contacts` array.

## 5) UI workflow

1. Open dashboard.
2. Set `Min Contact Confidence` filter.
3. Use `Enrich Visible Leads` to enrich current filtered leads.
4. Expand a lead card to view contact cards and confidence chips.
5. Export CSV to include best contact fields.

## 6) Provider response contract

Your `CONTACT_ENRICH_API_BASE_URL` service should expose:

- `POST /enrich`

Payload sent:

```json
{
  "name": "Business Name",
  "website": "https://example.com",
  "city": "Austin",
  "state": "TX",
  "country": "US"
}
```

Expected response shape:

```json
{
  "contacts": [
    {
      "full_name": "Jordan Smith",
      "title": "Operations Manager",
      "email": "jordan.smith@example.com",
      "email_verified": true,
      "phone_direct": "+1 555 123 4567",
      "linkedin_profile_url": "https://linkedin.com/in/jordansmith",
      "source_platform": "provider_api",
      "source_url": "https://provider.example.com/result/123",
      "confidence_score": 88,
      "last_verified_at": "2026-06-17T00:00:00.000Z"
    }
  ]
}
```

## 7) Notes

- If provider keys are missing, enrichment falls back to public website contact extraction.
- Contact confidence scores are stored in `lead_contacts.confidence_score`.
- Best contact summary is stored on each lead for quick list and CSV access.
