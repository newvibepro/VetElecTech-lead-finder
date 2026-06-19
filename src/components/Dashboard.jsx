import React, { useState, useEffect } from 'react';
import { Search, Wifi, TrendingUp, Shield } from 'lucide-react';
import LeadMap from './LeadMap';
import LeadList from './LeadList';
import StatsPanel from './StatsPanel';
import './Dashboard.css';

function Dashboard() {
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [apiStatus, setApiStatus] = useState({ loading: true, mapsConfigured: false, yelpConfigured: false, appVersion: 'unknown' });
  const [searchFeedback, setSearchFeedback] = useState({ error: '', diagnostics: null, mode: '', rawCount: 0 });
  const [enrichFeedback, setEnrichFeedback] = useState({ loading: false, message: '', error: '' });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('map');
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchMode, setSearchMode] = useState('live');
  const [selectedState, setSelectedState] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [minContactConfidence, setMinContactConfidence] = useState(0);
  const [selectedIndustry, setSelectedIndustry] = useState('');

  const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || 'newvibeproducts@gmail.com';
  const appAttribution = import.meta.env.VITE_APP_ATTRIBUTION || 'VetElecTech.com';
  const frontendVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

  const targetStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];

  const industries = [
    'hospital', 'manufacturing', 'financial', 'hotel', 'school',
    'government', 'construction', 'agriculture', 'logistics', 'data_center',
    'oil_gas', 'gas_station'
  ];

  useEffect(() => {
    fetchTopLeads();
    fetchStats();
    fetchApiStatus();
  }, []);

  useEffect(() => {
    fetchTopLeads();
  }, [minContactConfidence]);

  useEffect(() => {
    let filtered = leads;

    if (selectedState) {
      filtered = filtered.filter(l => l.state === selectedState);
    }
    if (minScore > 0) {
      filtered = filtered.filter(l => {
        const score = searchMode === 'live'
          ? (l.live_fit_score ?? l.overall_score ?? 0)
          : (l.overall_score ?? 0);
        return score >= minScore;
      });
    }
    if (selectedIndustry) {
      filtered = filtered.filter(l =>
        (l.business_type || '').toLowerCase().includes(selectedIndustry) ||
        (l.categories || []).some(c => c.toLowerCase().includes(selectedIndustry))
      );
    }
    // Search endpoints already return query-filtered results.
    // Avoid re-filtering locally because it can hide valid matches.

    setFilteredLeads(filtered);
  }, [leads, searchMode, selectedState, minScore, selectedIndustry]);

  const fetchTopLeads = async () => {
    setLoading(true);
    try {
      const url = `/.netlify/functions/getTopLeads?limit=100${selectedState ? `&state=${selectedState}` : ''}&includeContacts=1&minContactConfidence=${minContactConfidence}`;
      const response = await fetch(url);
      const data = await response.json();
      setLeads(data.leads || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/.netlify/functions/getStats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchApiStatus = async () => {
    try {
      const response = await fetch('/.netlify/functions/getApiStatus');
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Unable to fetch API status');

      setApiStatus({
        loading: false,
        mapsConfigured: Boolean(data.mapsConfigured),
        yelpConfigured: Boolean(data.yelpConfigured),
        appVersion: data.appVersion || 'unknown'
      });
    } catch (error) {
      console.error('Error fetching API status:', error);
      setApiStatus({ loading: false, mapsConfigured: false, yelpConfigured: false, appVersion: 'unknown' });
    }
  };

  const liveConfigured = apiStatus.mapsConfigured || apiStatus.yelpConfigured;
  const liveStatusText = apiStatus.loading
    ? 'Checking keys...'
    : (liveConfigured ? `Live API Ready${apiStatus.mapsConfigured && !apiStatus.yelpConfigured ? ' (Maps only)' : ''}` : 'Live API Missing Keys');
  const liveStatusClass = apiStatus.loading
    ? 'api-status-loading'
    : (liveConfigured ? 'api-status-ready' : 'api-status-missing');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setSearchFeedback({ error: '', diagnostics: null, mode: searchMode, rawCount: 0 });
    try {
      const params = new URLSearchParams({ q: searchTerm.trim(), minScore: String(minScore) });

      if (selectedState) params.set('state', selectedState);
      params.set('includeContacts', '1');
      params.set('minContactConfidence', String(minContactConfidence));

      let endpoint = '/.netlify/functions/searchLeads';

      if (searchMode === 'live' || searchMode === 'raw_maps') {
        endpoint = '/.netlify/functions/liveSearch';
        params.set('limit', searchMode === 'raw_maps' ? '100' : '80');
        params.set('maxTerms', searchMode === 'raw_maps' ? '1' : '3');
        params.set('sources', 'maps');
        if (searchMode === 'raw_maps') {
          params.set('rawMode', '1');
          params.set('scoreTopN', '10');
        }
      }

      const url = `${endpoint}?${params.toString()}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Search failed');
      }

      setLeads(data.results || []);
      setSearchFeedback({
        error: '',
        diagnostics: (searchMode === 'live' || searchMode === 'raw_maps') ? (data.diagnostics || null) : null,
        mode: searchMode,
        rawCount: Array.isArray(data.results) ? data.results.length : (data.count || 0)
      });
    } catch (error) {
      console.error('Error searching:', error);
      setSearchFeedback({ error: error.message || 'Search failed', diagnostics: null, mode: searchMode, rawCount: 0 });
    } finally {
      setLoading(false);
    }
  };

  const enrichVisibleLeads = async () => {
    const visibleIds = filteredLeads
      .map((lead) => lead.id)
      .filter(Boolean)
      .slice(0, 150);

    const visibleSourceIds = filteredLeads
      .map((lead) => lead.source_id)
      .filter(Boolean)
      .slice(0, 150);

    if (visibleIds.length === 0 && visibleSourceIds.length === 0) {
      setEnrichFeedback({ loading: false, message: '', error: 'No visible leads to enrich. Run a search first.' });
      return;
    }

    setEnrichFeedback({ loading: true, message: '', error: '' });
    try {
      const response = await fetch('/.netlify/functions/batchEnrichContacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: visibleIds, sourceIds: visibleSourceIds, onlyMissing: false })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Batch enrichment failed');

      setEnrichFeedback({
        loading: false,
        message: `Enriched ${data.leadsAttempted || 0} leads. Contacts created/updated: ${data.contactsCreated || 0}.`,
        error: ''
      });

      await fetchTopLeads();
    } catch (error) {
      setEnrichFeedback({ loading: false, message: '', error: error.message || 'Batch enrichment failed' });
    }
  };

  const exportAsCSV = () => {
    const totalContactsFound = filteredLeads.reduce((sum, lead) => sum + ((lead.contacts || []).length), 0);

    const verifiedEmailCount = filteredLeads.reduce((sum, lead) => {
      const contacts = lead.contacts || [];
      const verifiedForLead = contacts.filter(c => c.email && c.email_verified).length;
      if (verifiedForLead > 0) return sum + verifiedForLead;
      return sum + (lead.best_contact_email ? 1 : 0);
    }, 0);

    const leadsAboveConfidenceThreshold = filteredLeads.filter((lead) => {
      const bestFromSummary = Number(lead.best_contact_confidence || 0);
      const bestFromContacts = Math.max(0, ...(lead.contacts || []).map(c => Number(c.confidence_score || 0)));
      const best = Math.max(bestFromSummary, bestFromContacts);
      return best >= minContactConfidence;
    }).length;

    const leadsWithAnyContacts = filteredLeads.filter((lead) => {
      return (lead.contacts || []).length > 0 || Boolean(lead.best_contact_email || lead.best_contact_name);
    }).length;

    const headers = [
      'Name', 'City', 'State', 'Overall Score',
      'Connectivity Criticality', 'Industry Alignment',
      'Service Area Fit', 'Business Viability', 'Accessibility',
      'Business Type', 'Website', 'Phone',
      'Best Contact Name', 'Best Contact Email', 'Best Contact Confidence', 'Best Contact Source'
    ];
    const rows = filteredLeads.map(l => [
      l.name, l.city, l.state, l.overall_score,
      l.connectivity_criticality_score, l.industry_alignment_score,
      l.service_area_fit_score, l.business_viability_score, l.accessibility_score,
      l.business_type || '', l.website || '', l.phone || '',
      l.best_contact_name || l.contacts?.[0]?.full_name || '',
      l.best_contact_email || l.contacts?.[0]?.email || '',
      l.best_contact_confidence || l.contacts?.[0]?.confidence_score || 0,
      l.best_contact_source || l.contacts?.[0]?.source_platform || ''
    ].map(v => `"${v}"`).join(','));

    const summaryRows = [
      ['Report Generated At', new Date().toISOString()],
      ['Visible Leads', filteredLeads.length],
      ['Active Filters', `mode=${searchMode || 'db'}; state=${selectedState || 'ALL'}; industry=${selectedIndustry || 'ALL'}; minScore=${minScore}; minContactConfidence=${minContactConfidence}; searchTerm=${searchTerm ? searchTerm.trim() : 'none'}`],
      ['Min Contact Confidence Filter', minContactConfidence],
      ['Total Contacts Found', totalContactsFound],
      ['Verified Emails', verifiedEmailCount],
      ['Leads Above Confidence Threshold', leadsAboveConfidenceThreshold],
      ['Leads With Any Contact Data', leadsWithAnyContacts],
      []
    ].map((row) => row.map((value) => `"${value}"`).join(','));

    const csv = [...summaryRows, headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vetelectech-leads.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-brand">
            <div className="brand-logo">
              <Shield size={32} />
            </div>
            <div>
              <h1>VetElecTech Lead Finder</h1>
              <p>Starlink Backup Network — B2B Prospect Discovery</p>
            </div>
          </div>
          <div className="header-stats">
            <div className="version-pill" title="Frontend build and backend API versions">
              <span>UI v{frontendVersion}</span>
              <span>API v{apiStatus.appVersion}</span>
            </div>
            <button
              type="button"
              className="btn btn-help-toggle"
              onClick={() => setShowHowItWorks((prev) => !prev)}
              aria-expanded={showHowItWorks}
            >
              {showHowItWorks ? 'Hide Help' : 'How It Works'}
            </button>
            <div className={`api-status-pill ${liveStatusClass}`}>
              <Wifi size={14} />
              <span>{liveStatusText}</span>
            </div>
            <div className="stat-card">
              <div className="stat-number">{leads.length}</div>
              <div className="stat-label">Leads Found</div>
            </div>
            {stats && (
              <>
                <div className="stat-card">
                  <div className="stat-number">{stats.avg_score}</div>
                  <div className="stat-label">Avg Score</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{stats.high_quality_70 || 0}</div>
                  <div className="stat-label">Hot Leads (70+)</div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {showHowItWorks && (
        <section className="how-it-works-wrap">
          <div className="how-it-works-card">
            <h3>How This App Works</h3>
            <p>This workflow discovers and ranks companies that are likely to need resilient backup internet connectivity.</p>
            <ol>
              <li>Search live (Google Maps) or query saved leads from Supabase.</li>
              <li>Score each lead by business fit, criticality, and service viability.</li>
              <li>Optionally enrich visible leads with contact intelligence and confidence scores.</li>
              <li>Review in Map/List/Analytics and export filtered results to CSV.</li>
            </ol>
            <p className="how-note">Data is sourced from Google Maps, Yelp, and public company web pages. Validate contacts before outreach.</p>
          </div>
        </section>
      )}

      {/* Controls */}
      <div className="dashboard-controls">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder={
              searchMode === 'db'
                ? 'Search saved leads by name, type, city...'
                : (searchMode === 'raw_maps'
                  ? 'Raw Maps: Pilot truck stop, Loves Travel Stop, TA...' :
                  'Live discover: hospital, warehouse, rural clinic...')
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Search size={17} />
            {loading ? 'Searching...' : (searchMode === 'db' ? 'DB Search' : (searchMode === 'raw_maps' ? 'Raw Maps' : 'Live Search'))}
          </button>
        </form>

        <div className="filters">
          <div className="filter-group">
            <label>Search Mode:</label>
            <select value={searchMode} onChange={(e) => setSearchMode(e.target.value)} className="filter-select">
              <option value="live">Live Discovery (Google Maps)</option>
              <option value="raw_maps">Raw Maps (Top 10 Scored)</option>
              <option value="db">Saved Leads (Database)</option>
            </select>
          </div>

          <div className="filter-group">
            <label>State:</label>
            <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)} className="filter-select">
              <option value="">All States</option>
              {targetStates.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label>Industry:</label>
            <select value={selectedIndustry} onChange={(e) => setSelectedIndustry(e.target.value)} className="filter-select">
              <option value="">All Industries</option>
              {industries.map(ind => (
                <option key={ind} value={ind}>{ind.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Min Score:</label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={minScore}
              onChange={(e) => {
                const next = Number.parseInt(e.target.value || '0', 10);
                setMinScore(Number.isFinite(next) ? Math.max(0, Math.min(100, next)) : 0);
              }}
              className="filter-select"
            />
          </div>

          <div className="filter-group">
            <label>Min Contact Confidence:</label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={minContactConfidence}
              onChange={(e) => {
                const next = Number.parseInt(e.target.value || '0', 10);
                setMinContactConfidence(Number.isFinite(next) ? Math.max(0, Math.min(100, next)) : 0);
              }}
              className="filter-select"
            />
          </div>

          <button onClick={enrichVisibleLeads} className="btn btn-tertiary" disabled={enrichFeedback.loading || filteredLeads.length === 0}>
            {enrichFeedback.loading ? 'Enriching...' : 'Enrich Visible Leads'}
          </button>

          <button onClick={exportAsCSV} className="btn btn-secondary">
            📥 Export CSV
          </button>
        </div>
      </div>

      {(enrichFeedback.message || enrichFeedback.error) && (
        <div className="search-feedback-strip">
          {enrichFeedback.error ? (
            <div className="search-feedback-error">Contact enrichment error: {enrichFeedback.error}</div>
          ) : (
            <div className="search-feedback-ok">{enrichFeedback.message}</div>
          )}
        </div>
      )}

      {(searchFeedback.error || ((searchFeedback.mode === 'live' || searchFeedback.mode === 'raw_maps') && searchFeedback.diagnostics)) && (
        <div className="search-feedback-strip">
          {searchFeedback.error ? (
            <div className="search-feedback-error">
              Search error: {searchFeedback.error}
            </div>
          ) : (
            <div className="search-feedback-ok">
              <strong>{searchFeedback.mode === 'raw_maps' ? 'Raw Maps diagnostics:' : 'Live diagnostics:'}</strong>
              {' apiResults='}{searchFeedback.rawCount || 0}
              {' | rendered='}{filteredLeads.length}
              {' terms='}{searchFeedback.diagnostics?.terms?.length || 0}
              {' | googleCount='}{searchFeedback.diagnostics?.googleCount || 0}
              {searchFeedback.mode === 'raw_maps' ? ` | scoredTopN=${searchFeedback.diagnostics?.scoreTopN || 0}` : ''}
              {' | state='}{searchFeedback.diagnostics?.location || 'N/A'}
              {' | providerErrors='}{searchFeedback.diagnostics?.providerErrors?.length || 0}
              {(searchFeedback.diagnostics?.warnings?.length || 0) > 0 ? ` | warnings=${searchFeedback.diagnostics.warnings.length}` : ''}
              {filteredLeads.length === 0 ? ' | tip: clear Industry filter and set Min Score to 0.' : ''}
              {(searchFeedback.diagnostics?.providerErrors?.length || 0) > 0 && (
                <div style={{ marginTop: '6px', fontWeight: 600, color: '#b91c1c' }}>
                  Provider error: {searchFeedback.diagnostics.providerErrors[0]?.source || 'unknown'}
                  {' | status='}{searchFeedback.diagnostics.providerErrors[0]?.status || 'N/A'}
                  {' | term='}{searchFeedback.diagnostics.providerErrors[0]?.term || 'N/A'}
                  {' | message='}{searchFeedback.diagnostics.providerErrors[0]?.message || 'N/A'}
                </div>
              )}
              {(searchFeedback.diagnostics?.warnings?.length || 0) > 0 && (
                <div style={{ marginTop: '4px', color: '#92400e' }}>
                  Warning: {searchFeedback.diagnostics.warnings[0]}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button
          className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          📍 Map View
        </button>
        <button
          className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          📋 Lead List ({filteredLeads.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Analytics
        </button>
      </div>

      {/* Loading bar */}
      {loading && <div className="loading-bar"><div className="loading-fill" /></div>}

      {/* Tab content */}
      <div className="dashboard-content">
        {activeTab === 'map'   && <LeadMap   leads={filteredLeads} />}
        {activeTab === 'list'  && <LeadList  leads={filteredLeads} />}
        {activeTab === 'stats' && <StatsPanel stats={stats} leads={filteredLeads} contactConfidenceThreshold={minContactConfidence} />}
      </div>

      <footer className="dashboard-footer">
        <div className="dashboard-footer-inner">
          <p>
            Questions? Contact{' '}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </p>
          <p>
            Built for {appAttribution}. Lead intelligence powered by VetElecTech Lead Finder.
          </p>
          <p>
            Version: UI v{frontendVersion} | API v{apiStatus.appVersion}
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Dashboard;
