import React, { useState } from 'react';
import { MapPin, Globe, Phone, Wifi, Building2 } from 'lucide-react';
import './LeadList.css';

const INDUSTRY_ICONS = {
  hospital: '🏥',
  medical: '🏥',
  manufacturing: '🏭',
  factory: '🏭',
  financial: '🏦',
  bank: '🏦',
  hotel: '🏨',
  hospitality: '🏨',
  school: '🎓',
  education: '🎓',
  government: '🏛️',
  construction: '🏗️',
  agriculture: '🌾',
  logistics: '📦',
  warehouse: '📦',
  default: '🏢'
};

function getIcon(lead) {
  const type = (lead.business_type || '').toLowerCase();
  const cats = (lead.categories || []).map(c => c.toLowerCase()).join(' ');
  const combined = `${type} ${cats}`;
  for (const [key, icon] of Object.entries(INDUSTRY_ICONS)) {
    if (combined.includes(key)) return icon;
  }
  return INDUSTRY_ICONS.default;
}

function LeadList({ leads = [] }) {
  const [sortBy, setSortBy] = useState('score');
  const [expandedId, setExpandedId] = useState(null);

  const sorted = [...leads].sort((a, b) => {
    switch (sortBy) {
      case 'score':        return b.overall_score - a.overall_score;
      case 'criticality':  return b.connectivity_criticality_score - a.connectivity_criticality_score;
      case 'name':         return a.name.localeCompare(b.name);
      case 'rating':       return (b.google_rating || 0) - (a.google_rating || 0);
      default:             return 0;
    }
  });

  const getScoreColor = (score) => {
    if (score >= 80) return 'var(--green)';
    if (score >= 60) return 'var(--amber)';
    return 'var(--red)';
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Priority';
    if (score >= 70) return 'Hot Lead';
    if (score >= 60) return 'Warm';
    if (score >= 50) return 'Potential';
    return 'Cold';
  };

  return (
    <div className="lead-list">
      <div className="list-controls">
        <span className="list-count">{sorted.length} leads</span>
        <div className="sort-group">
          <label>Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
            <option value="score">Overall Score</option>
            <option value="criticality">Connectivity Criticality</option>
            <option value="rating">Google Rating</option>
            <option value="name">Business Name</option>
          </select>
        </div>
      </div>

      <div className="leads-grid">
        {sorted.length === 0 ? (
          <div className="empty-state">
            <Wifi size={40} />
            <p>No leads found. Try adjusting filters or run the scraper.</p>
          </div>
        ) : (
          sorted.map((lead) => (
            <div
              key={lead.id || lead.source_id}
              className={`lead-card ${expandedId === (lead.id || lead.source_id) ? 'expanded' : ''}`}
              onClick={() => setExpandedId(expandedId === (lead.id || lead.source_id) ? null : (lead.id || lead.source_id))}
            >
              {/* Score badge */}
              <div className="score-badge" style={{ backgroundColor: getScoreColor(lead.overall_score) }}>
                <span className="score-number">{lead.overall_score}</span>
                <span className="score-label">{getScoreLabel(lead.overall_score)}</span>
              </div>

              {/* Header */}
              <div className="lead-header">
                <div className="lead-icon">{getIcon(lead)}</div>
                <div>
                  <h3>{lead.name}</h3>
                  <p className="lead-location">
                    <MapPin size={13} /> {lead.city}, {lead.state} {lead.zip_code}
                  </p>
                  {lead.business_type && (
                    <span className="industry-tag">{lead.business_type.replace('_', ' ')}</span>
                  )}
                </div>
              </div>

              {/* Score bars */}
              <div className="score-bars">
                <ScoreBar label="Connectivity Need" value={lead.connectivity_criticality_score} color="#ef4444" />
                <ScoreBar label="Industry Fit"      value={lead.industry_alignment_score}       color="#3b82f6" />
                <ScoreBar label="Service Area"      value={lead.service_area_fit_score}         color="var(--gold)" />
                <ScoreBar label="Biz Viability"     value={lead.business_viability_score}       color="var(--green)" />
              </div>

              {/* Expanded details */}
              {expandedId === (lead.id || lead.source_id) && (
                <div className="lead-details">
                  {lead.description && (
                    <p className="lead-description">{lead.description.substring(0, 200)}{lead.description.length > 200 ? '...' : ''}</p>
                  )}
                  <div className="contact-links">
                    {lead.website && (
                      <a href={lead.website} target="_blank" rel="noopener noreferrer" className="contact-link" onClick={e => e.stopPropagation()}>
                        <Globe size={14} /> Website
                      </a>
                    )}
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`} className="contact-link" onClick={e => e.stopPropagation()}>
                        <Phone size={14} /> {lead.phone}
                      </a>
                    )}
                    {lead.google_maps_url && (
                      <a href={lead.google_maps_url} target="_blank" rel="noopener noreferrer" className="contact-link" onClick={e => e.stopPropagation()}>
                        <MapPin size={14} /> Maps
                      </a>
                    )}
                  </div>
                  {(lead.google_rating || lead.yelp_rating) && (
                    <div className="ratings-row">
                      {lead.google_rating && (
                        <span className="rating-chip">Google: ⭐ {lead.google_rating} ({lead.google_review_count} reviews)</span>
                      )}
                      {lead.yelp_rating && (
                        <span className="rating-chip">Yelp: ⭐ {lead.yelp_rating} ({lead.yelp_review_count} reviews)</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ScoreBar({ label, value, color }) {
  return (
    <div className="score-bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${value || 0}%`, backgroundColor: color }} />
      </div>
      <span className="bar-value">{value || 0}</span>
    </div>
  );
}

export default LeadList;
