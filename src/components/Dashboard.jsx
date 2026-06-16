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
  const [apiStatus, setApiStatus] = useState({ loading: true, mapsConfigured: false, yelpConfigured: false });
  const [searchFeedback, setSearchFeedback] = useState({ error: '', diagnostics: null, mode: '', rawCount: 0 });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('map');

  const [searchTerm, setSearchTerm] = useState('');
  const [searchMode, setSearchMode] = useState('live');
  const [selectedState, setSelectedState] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [selectedIndustry, setSelectedIndustry] = useState('');

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
    // In live mode, results are already query-filtered by the backend.
    if (searchMode !== 'live' && searchTerm) {
      filtered = filtered.filter(l =>
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.city || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLeads(filtered);
  }, [leads, searchMode, selectedState, minScore, selectedIndustry, searchTerm]);

  const fetchTopLeads = async () => {
    setLoading(true);
    try {
      const url = `/.netlify/functions/getTopLeads?limit=100${selectedState ? `&state=${selectedState}` : ''}`;
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
        yelpConfigured: Boolean(data.yelpConfigured)
      });
    } catch (error) {
      console.error('Error fetching API status:', error);
      setApiStatus({ loading: false, mapsConfigured: false, yelpConfigured: false });
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

      let endpoint = '/.netlify/functions/searchLeads';

      if (searchMode === 'live') {
        endpoint = '/.netlify/functions/liveSearch';
        params.set('limit', '80');
        params.set('maxTerms', '3');
        params.set('sources', 'maps');
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
        diagnostics: searchMode === 'live' ? (data.diagnostics || null) : null,
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

  const exportAsCSV = () => {
    const headers = [
      'Name', 'City', 'State', 'Overall Score',
      'Connectivity Criticality', 'Industry Alignment',
      'Service Area Fit', 'Business Viability', 'Accessibility',
      'Business Type', 'Website', 'Phone'
    ];
    const rows = filteredLeads.map(l => [
      l.name, l.city, l.state, l.overall_score,
      l.connectivity_criticality_score, l.industry_alignment_score,
      l.service_area_fit_score, l.business_viability_score, l.accessibility_score,
      l.business_type || '', l.website || '', l.phone || ''
    ].map(v => `"${v}"`).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
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

      {/* Controls */}
      <div className="dashboard-controls">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder={searchMode === 'live' ? 'Live discover: hospital, warehouse, rural clinic...' : 'Search saved leads by name, type, city...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Search size={17} />
            {loading ? 'Searching...' : (searchMode === 'live' ? 'Live Search' : 'DB Search')}
          </button>
        </form>

        <div className="filters">
          <div className="filter-group">
            <label>Search Mode:</label>
            <select value={searchMode} onChange={(e) => setSearchMode(e.target.value)} className="filter-select">
              <option value="live">Live Discovery (Google Maps)</option>
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

          <button onClick={exportAsCSV} className="btn btn-secondary">
            📥 Export CSV
          </button>
        </div>
      </div>

      {(searchFeedback.error || (searchFeedback.mode === 'live' && searchFeedback.diagnostics)) && (
        <div className="search-feedback-strip">
          {searchFeedback.error ? (
            <div className="search-feedback-error">
              Search error: {searchFeedback.error}
            </div>
          ) : (
            <div className="search-feedback-ok">
              <strong>Live diagnostics:</strong>
              {' apiResults='}{searchFeedback.rawCount || 0}
              {' | rendered='}{filteredLeads.length}
              {' terms='}{searchFeedback.diagnostics?.terms?.length || 0}
              {' | googleCount='}{searchFeedback.diagnostics?.googleCount || 0}
              {' | state='}{searchFeedback.diagnostics?.location || 'N/A'}
              {filteredLeads.length === 0 ? ' | tip: clear Industry filter and set Min Score to 0.' : ''}
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
        {activeTab === 'stats' && <StatsPanel stats={stats} leads={filteredLeads} />}
      </div>
    </div>
  );
}

export default Dashboard;
