import React from 'react';
import './LeadMap.css';

function LeadMap({ leads = [] }) {
  const stateCount = leads.reduce((acc, lead) => {
    acc[lead.state] = (acc[lead.state] || 0) + 1;
    return acc;
  }, {});

  const avgScore = leads.length > 0
    ? (leads.reduce((sum, l) => sum + (l.overall_score || 0), 0) / leads.length).toFixed(1)
    : 0;

  const topLeads = [...leads]
    .sort((a, b) => b.overall_score - a.overall_score)
    .slice(0, 8);

  const maxCount = Math.max(...Object.values(stateCount), 1);

  const getScoreColor = (score) => {
    if (score >= 80) return 'var(--green)';
    if (score >= 60) return 'var(--amber)';
    return 'var(--red)';
  };

  return (
    <div className="lead-map">
      <div className="map-placeholder">
        <div className="map-header">
          <div className="map-title">📡 Lead Distribution Map</div>
          <p className="map-note">
            Integrate Mapbox GL or Leaflet for interactive map.
            Geographic coverage shown below.
          </p>
        </div>

        {/* Summary stats */}
        <div className="map-stats-grid">
          <div className="map-stat">
            <div className="map-stat-value">{leads.length}</div>
            <div className="map-stat-label">Total Leads</div>
          </div>
          <div className="map-stat">
            <div className="map-stat-value">{avgScore}</div>
            <div className="map-stat-label">Avg Score</div>
          </div>
          <div className="map-stat">
            <div className="map-stat-value">{Object.keys(stateCount).length}</div>
            <div className="map-stat-label">States Covered</div>
          </div>
          <div className="map-stat">
            <div className="map-stat-value">{leads.filter(l => l.overall_score >= 70).length}</div>
            <div className="map-stat-label">Hot Leads (70+)</div>
          </div>
        </div>

        <div className="map-panels">
          {/* State distribution */}
          <div className="panel">
            <h4>Leads by State</h4>
            <div className="state-list">
              {Object.entries(stateCount)
                .sort((a, b) => b[1] - a[1])
                .map(([state, count]) => (
                  <div key={state} className="state-item">
                    <span className="state-name">{state}</span>
                    <div className="state-bar">
                      <div
                        className="state-fill"
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="state-count">{count}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Top leads */}
          <div className="panel">
            <h4>Top Priority Leads</h4>
            <ul className="top-leads-list">
              {topLeads.map((lead, i) => (
                <li key={lead.id || lead.source_id || i} className="top-lead-item">
                  <span className="rank">#{i + 1}</span>
                  <div className="lead-info">
                    <span className="lead-name">{lead.name}</span>
                    <span className="lead-loc">{lead.city}, {lead.state}</span>
                  </div>
                  <span
                    className="lead-score"
                    style={{ backgroundColor: getScoreColor(lead.overall_score) }}
                  >
                    {lead.overall_score}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LeadMap;
