import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
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

  const mappableLeads = leads.filter(l => {
    const lat = Number(l.latitude);
    const lng = Number(l.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng);
  });

  const mapCenter = mappableLeads.length
    ? [
        mappableLeads.reduce((sum, l) => sum + Number(l.latitude), 0) / mappableLeads.length,
        mappableLeads.reduce((sum, l) => sum + Number(l.longitude), 0) / mappableLeads.length
      ]
    : [39.5, -98.35];

  const mapZoom = mappableLeads.length > 0 ? (mappableLeads.length === 1 ? 10 : 5) : 4;

  const maxCount = Math.max(...Object.values(stateCount), 1);

  const getScoreColor = (score) => {
    if (score >= 80) return 'var(--green)';
    if (score >= 60) return 'var(--amber)';
    return 'var(--red)';
  };

  return (
    <div className="lead-map">
      <div className="map-shell">
        <div className="map-header">
          <div className="map-title">📡 Lead Distribution Map</div>
          <p className="map-note">
            Interactive map powered by Leaflet and OpenStreetMap.
            {mappableLeads.length === 0 ? ' No geocoded leads yet.' : ` Showing ${mappableLeads.length} geocoded leads.`}
          </p>
        </div>

        <div className="lead-map-canvas">
          <MapContainer center={mapCenter} zoom={mapZoom} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {mappableLeads.map((lead, i) => (
              <CircleMarker
                key={lead.id || lead.source_id || i}
                center={[Number(lead.latitude), Number(lead.longitude)]}
                radius={Math.max(6, Math.min(12, Math.round((lead.overall_score || 0) / 10)))}
                pathOptions={{
                  color: getScoreColor(lead.overall_score || 0),
                  fillColor: getScoreColor(lead.overall_score || 0),
                  fillOpacity: 0.5,
                  weight: 1.5
                }}
              >
                <Popup>
                  <div className="map-popup">
                    <strong>{lead.name}</strong>
                    <div>{lead.city}, {lead.state}</div>
                    <div>Score: {lead.overall_score ?? 'N/A'}</div>
                    {lead.business_type ? <div>Type: {lead.business_type}</div> : null}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
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
