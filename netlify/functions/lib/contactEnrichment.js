/**
 * Contact enrichment helpers for Netlify functions.
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');

const DEFAULT_TIMEOUT_MS = parseInt(process.env.CONTACT_ENRICH_TIMEOUT_MS || '12000', 10);
const MAX_CONTACTS_PER_LEAD = parseInt(process.env.CONTACT_ENRICH_MAX_CONTACTS_PER_LEAD || '5', 10);
const MIN_CONFIDENCE = parseInt(process.env.CONTACT_ENRICH_MIN_CONFIDENCE || '55', 10);
const WEBSITE_CRAWL_ENABLED = /^(1|true|yes|on)$/i.test(String(process.env.CONTACT_WEBSITE_CRAWL_ENABLED || 'true'));
const WEBSITE_CRAWL_MAX_PAGES = parseInt(process.env.CONTACT_WEBSITE_CRAWL_MAX_PAGES || '6', 10);
const WEBSITE_CRAWL_TIMEOUT_MS = parseInt(process.env.CONTACT_WEBSITE_CRAWL_TIMEOUT_MS || '8000', 10);
const WEBSITE_CRAWL_USER_AGENT = process.env.CONTACT_WEBSITE_CRAWL_USER_AGENT || 'VetElecTechLeadFinderBot/1.0';
const CONTACT_ENRICHMENT_ENABLED = /^(1|true|yes|on)$/i.test(String(process.env.CONTACT_ENRICHMENT_ENABLED || 'true'));

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  );
}

function parseDomain(raw) {
  if (!raw) return '';
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withScheme).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function inferNames(fullName) {
  const parts = normalizeName(fullName).split(' ').filter(Boolean);
  if (!parts.length) return { first_name: null, last_name: null };
  if (parts.length === 1) return { first_name: parts[0], last_name: null };
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(' ')
  };
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  return email;
}

function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/\s+/g, ' ');
}

function buildDedupeKey(contact) {
  const email = normalizeEmail(contact.email);
  const name = normalizeName(contact.full_name).toLowerCase();
  const source = String(contact.source_platform || 'unknown').toLowerCase();
  const phone = normalizePhone(contact.phone_direct).replace(/[^0-9]/g, '');
  return [email || 'none', name || 'none', phone || 'none', source].join('|');
}

function clampScore(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function computeConfidence(contact, lead) {
  let score = 15;
  const leadDomain = parseDomain(lead.website || lead.company_domain || '');
  const email = normalizeEmail(contact.email);

  if (email) score += 25;
  if (contact.email_verified) score += 20;
  if (contact.title) score += 8;
  if (contact.linkedin_profile_url) score += 10;
  if (contact.phone_direct) score += 6;

  if (email && leadDomain) {
    const emailDomain = email.split('@')[1] || '';
    if (emailDomain === leadDomain) score += 12;
  }

  if (contact.source_platform === 'provider_api') score += 10;
  if (contact.source_platform === 'website') score += 7;
  if (contact.source_platform === 'linkedin') score += 9;

  return clampScore(score);
}

function toContactRecord(contact, lead) {
  const full_name = normalizeName(contact.full_name || contact.name || '');
  const names = inferNames(full_name);
  const email = normalizeEmail(contact.email);

  const record = {
    full_name: full_name || null,
    first_name: names.first_name,
    last_name: names.last_name,
    title: normalizeName(contact.title || '') || null,
    department: normalizeName(contact.department || '') || null,
    seniority: normalizeName(contact.seniority || '') || null,
    email: email || null,
    email_verified: Boolean(contact.email_verified),
    email_status: normalizeName(contact.email_status || '') || null,
    phone_direct: normalizePhone(contact.phone_direct || contact.phone || '') || null,
    linkedin_profile_url: contact.linkedin_profile_url || null,
    source_platform: String(contact.source_platform || 'website').toLowerCase(),
    source_url: contact.source_url || null,
    notes: normalizeName(contact.notes || '') || null,
    last_verified_at: contact.last_verified_at || new Date().toISOString()
  };

  record.confidence_score = clampScore(contact.confidence_score || computeConfidence(record, lead));
  record.dedupe_key = buildDedupeKey(record);

  return record;
}

function extractContactItemsFromHtml(html, pageUrl) {
  const $ = cheerio.load(html || '');
  const text = $('body').text() || '';
  const found = [];

  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const phoneRegex = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g;

  const emailMatches = text.match(emailRegex) || [];
  const phoneMatches = text.match(phoneRegex) || [];

  for (const email of emailMatches.slice(0, 6)) {
    found.push({
      full_name: '',
      email,
      source_platform: 'website',
      source_url: pageUrl,
      email_verified: false
    });
  }

  if (phoneMatches.length) {
    found.push({
      full_name: '',
      phone_direct: phoneMatches[0],
      source_platform: 'website',
      source_url: pageUrl,
      notes: 'Extracted from public page text'
    });
  }

  $('a[href]').each((_, el) => {
    const href = String($(el).attr('href') || '');
    const label = normalizeName($(el).text());

    if (/linkedin\.com/i.test(href)) {
      found.push({
        full_name: label || '',
        linkedin_profile_url: href,
        source_platform: 'linkedin',
        source_url: pageUrl,
        notes: 'LinkedIn URL discovered on company website'
      });
    }

    if (/facebook\.com/i.test(href)) {
      found.push({
        full_name: label || '',
        source_platform: 'facebook',
        source_url: href,
        notes: 'Facebook URL discovered on company website'
      });
    }

    if (/indeed\.com/i.test(href)) {
      found.push({
        full_name: label || '',
        source_platform: 'indeed',
        source_url: href,
        notes: 'Indeed URL discovered on company website'
      });
    }
  });

  return found;
}

async function crawlWebsiteForContacts(lead) {
  if (!WEBSITE_CRAWL_ENABLED || !lead.website) return [];

  const baseUrl = /^https?:\/\//i.test(lead.website) ? lead.website : `https://${lead.website}`;
  const pages = [
    baseUrl,
    `${baseUrl.replace(/\/$/, '')}/contact`,
    `${baseUrl.replace(/\/$/, '')}/about`,
    `${baseUrl.replace(/\/$/, '')}/team`,
    `${baseUrl.replace(/\/$/, '')}/leadership`,
    `${baseUrl.replace(/\/$/, '')}/staff`
  ].slice(0, Math.max(1, WEBSITE_CRAWL_MAX_PAGES));

  const contacts = [];

  for (const pageUrl of pages) {
    try {
      const response = await axios.get(pageUrl, {
        timeout: WEBSITE_CRAWL_TIMEOUT_MS,
        headers: {
          'User-Agent': WEBSITE_CRAWL_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml'
        },
        maxRedirects: 3,
        validateStatus: (status) => status >= 200 && status < 400
      });

      const html = typeof response.data === 'string' ? response.data : '';
      contacts.push(...extractContactItemsFromHtml(html, pageUrl));
    } catch {
      // Skip unreachable pages silently; this is a best-effort fallback.
    }
  }

  return contacts;
}

async function callProviderApi(lead) {
  const apiKey = process.env.CONTACT_ENRICH_API_KEY;
  const apiBaseUrl = process.env.CONTACT_ENRICH_API_BASE_URL;

  if (!CONTACT_ENRICHMENT_ENABLED || !apiKey || !apiBaseUrl) return [];

  const payload = {
    name: lead.name,
    website: lead.website,
    city: lead.city,
    state: lead.state,
    country: 'US'
  };

  try {
    const response = await axios.post(
      `${String(apiBaseUrl).replace(/\/$/, '')}/enrich`,
      payload,
      {
        timeout: DEFAULT_TIMEOUT_MS,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const contacts = Array.isArray(response.data?.contacts) ? response.data.contacts : [];
    return contacts.map(c => ({ ...c, source_platform: c.source_platform || 'provider_api' }));
  } catch (error) {
    console.error('Provider enrichment error:', error.message);
    return [];
  }
}

function dedupeContacts(contacts) {
  const output = [];
  const seen = new Set();

  for (const contact of contacts) {
    const key = buildDedupeKey(contact);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(contact);
  }

  return output;
}

async function enrichLeadContacts(lead) {
  const providerContacts = await callProviderApi(lead);
  const websiteContacts = await crawlWebsiteForContacts(lead);
  const normalized = [...providerContacts, ...websiteContacts]
    .map(contact => toContactRecord(contact, lead))
    .filter(contact => contact.confidence_score >= MIN_CONFIDENCE);

  return dedupeContacts(normalized)
    .sort((a, b) => b.confidence_score - a.confidence_score)
    .slice(0, Math.max(1, MAX_CONTACTS_PER_LEAD));
}

async function upsertLeadContacts(supabase, leadId, contacts) {
  if (!contacts.length) return { upserted: 0 };

  const payload = contacts.map(contact => ({
    lead_id: leadId,
    ...contact,
    updated_at: new Date().toISOString()
  }));

  const { error } = await supabase
    .from('lead_contacts')
    .upsert(payload, { onConflict: 'lead_id,dedupe_key' });

  if (error) throw error;
  return { upserted: payload.length };
}

async function fetchLeadContacts(supabase, leadIds, minConfidence = 0) {
  const ids = (Array.isArray(leadIds) ? leadIds : []).filter(Boolean);
  if (!ids.length) return {};

  const { data, error } = await supabase
    .from('lead_contacts')
    .select('*')
    .in('lead_id', ids)
    .gte('confidence_score', Math.max(0, parseInt(minConfidence || 0, 10) || 0))
    .order('confidence_score', { ascending: false });

  if (error) throw error;

  return (data || []).reduce((acc, row) => {
    if (!acc[row.lead_id]) acc[row.lead_id] = [];
    acc[row.lead_id].push(row);
    return acc;
  }, {});
}

async function updateLeadContactSummary(supabase, lead, contacts) {
  const best = contacts[0] || null;

  const updates = {
    company_domain: parseDomain(lead.website || lead.company_domain || '') || null,
    contacts_enrichment_status: contacts.length ? 'completed' : 'no_contacts',
    contacts_enriched_at: new Date().toISOString(),
    best_contact_confidence: best ? best.confidence_score : 0,
    best_contact_source: best ? best.source_platform : null,
    best_contact_email: best ? best.email : null,
    best_contact_name: best ? best.full_name : null,
    linkedin_company_url: lead.linkedin_company_url || null,
    facebook_page_url: lead.facebook_page_url || null,
    indeed_company_url: lead.indeed_company_url || null
  };

  const { error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', lead.id);

  if (error) throw error;
}

module.exports = {
  getServiceClient,
  enrichLeadContacts,
  upsertLeadContacts,
  fetchLeadContacts,
  updateLeadContactSummary
};
