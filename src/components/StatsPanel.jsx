import React from 'react';
import './StatsPanel.css';

function StatsPanel({ stats = {}, leads = [], contactConfidenceThreshold = 0 }) {
  const byScore = leads.reduce((acc, l) => {
    if (l.overall_score >= 80) acc['80+']++;
    else if (l.overall_score >= 60) acc['60–79']++;
    else if (l.overall_score >= 40) acc['40–59']++;
    else acc['<40']++;
    return acc;
  }, { '80+': 0, '60–79': 0, '40–59': 0, '<40': 0 });

  const avg = (key) => leads.length > 0
    ? (leads.reduce((sum, l) => sum + (l[key] || 0), 0) / leads.length).toFixed(1)
    : 0;

  const byIndustry = leads.reduce((acc, l) => {
    const ind = (l.business_type || 'unknown').replace('_', ' ');
    acc[ind] = (acc[ind] || 0) + 1;
    return acc;
  }, {});

  const topIndustries = Object.entries(byIndustry)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const maxIndustryCount = Math.max(...Object.values(byIndustry), 1);

  const totalContactsFound = leads.reduce((sum, lead) => sum + ((lead.contacts || []).length), 0);

  const verifiedEmailCount = leads.reduce((sum, lead) => {
    const contacts = lead.contacts || [];
    const verifiedForLead = contacts.filter(c => c.email && c.email_verified).length;
    if (verifiedForLead > 0) return sum + verifiedForLead;

    const hasBestEmail = Boolean(lead.best_contact_email);
    return sum + (hasBestEmail ? 1 : 0);
  }, 0);

  const leadsAboveConfidenceThreshold = leads.filter((lead) => {
    const bestFromSummary = Number(lead.best_contact_confidence || 0);
    const bestFromContacts = Math.max(0, ...(lead.contacts || []).map(c => Number(c.confidence_score || 0)));
    const best = Math.max(bestFromSummary, bestFromContacts);
    return best >= contactConfidenceThreshold;
  }).length;

  const leadsWithAnyContacts = leads.filter((lead) => {
    return (lead.contacts || []).length > 0 || Boolean(lead.best_contact_email || lead.best_contact_name);
  }).length;

  return (
    <div className="stats-panel">
      <h2>📊 Lead Analytics Dashboard</h2>

      {/* Top KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card primary">
          <div className="kpi-label">Total Leads</div>
          <div className="kpi-value">{leads.length}</div>
          <div className="kpi-detail">Across all target states</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg Overall Score</div>
          <div className="kpi-value">{stats.avg_score || avg('overall_score')}</div>
          <div className="kpi-detail">Out of 100</div>
        </div>
        <div className="kpi-card hot">
          <div className="kpi-label">Hot Leads (70+)</div>
          <div className="kpi-value">{stats.high_quality_70 || leads.filter(l => l.overall_score >= 70).length}</div>
          <div className="kpi-detail">Ready to contact</div>
        </div>
        <div className="kpi-card priority">
          <div className="kpi-label">Priority (80+)</div>
          <div className="kpi-value">{stats.high_quality_80 || leads.filter(l => l.overall_score >= 80).length}</div>
          <div className="kpi-detail">Top-tier prospects</div>
        </div>
      </div>

      <div className="analytics-row">
        {/* Score distribution */}
        <div className="analytics-card">
          <h3>Score Distribution</h3>
          <div className="distribution-chart">
            {Object.entries(byScore).map(([range, count]) => {
              const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
              const color = range === '80+' ? 'var(--green)' :
                            range === '60–79' ? 'var(--amber)' :
                            range === '40–59' ? '#f97316' : 'var(--red)';
              return (
                <div key={range} className="dist-bar">
                  <div className="dist-label">{range}</div>
                  <div className="dist-track">
                    <div className="dist-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <div className="dist-count">{count}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Avg dimension scores */}
        <div className="analytics-card">
          <h3>Avg Dimension Scores</h3>
          <div className="dimension-bars">
            <DimBar label="Connectivity Criticality" value={avg('connectivity_criticality_score')} color="#ef4444" weight="35%" />
            <DimBar label="Industry Alignment"       value={avg('industry_alignment_score')}       color="#3b82f6" weight="25%" />
            <DimBar label="Service Area Fit"         value={avg('service_area_fit_score')}         color="var(--gold)" weight="20%" />
            <DimBar label="Business Viability"       value={avg('business_viability_score')}       color="var(--green)" weight="15%" />
            <DimBar label="Accessibility"            value={avg('accessibility_score')}            color="#8b5cf6" weight=" 5%" />
          </div>
        </div>
      </div>

      <div className="analytics-card full">
        <h3>Contact Intelligence</h3>
        <div className="contact-metrics-grid">
          <div className="contact-metric-card">
            <div className="contact-metric-label">Total Contacts Found</div>
            <div className="contact-metric-value">{totalContactsFound}</div>
            <div className="contact-metric-detail">Across visible leads</div>
          </div>
          <div className="contact-metric-card">
            <div className="contact-metric-label">Verified Emails</div>
            <div className="contact-metric-value">{verifiedEmailCount}</div>
            <div className="contact-metric-detail">Explicitly verified or best-contact fallback</div>
          </div>
          <div className="contact-metric-card">
            <div className="contact-metric-label">Leads Above Confidence Threshold</div>
            <div className="contact-metric-value">{leadsAboveConfidenceThreshold}</div>
            <div className="contact-metric-detail">Threshold: {contactConfidenceThreshold}</div>
          </div>
          <div className="contact-metric-card">
            <div className="contact-metric-label">Leads With Any Contact Data</div>
            <div className="contact-metric-value">{leadsWithAnyContacts}</div>
            <div className="contact-metric-detail">Name, email, or contact card present</div>
          </div>
        </div>
      </div>

      {/* Industry breakdown */}
      <div className="analytics-card full">
        <h3>Leads by Industry</h3>
        <div className="industry-chart">
          {topIndustries.map(([industry, count]) => (
            <div key={industry} className="industry-bar">
              <div className="industry-label">{industry}</div>
              <div className="industry-track">
                <div
                  className="industry-fill"
                  style={{ width: `${(count / maxIndustryCount) * 100}%` }}
                />
              </div>
              <div className="industry-count">{count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DimBar({ label, value, color, weight }) {
  return (
    <div className="dim-bar-row">
      <div className="dim-label">
        <span>{label}</span>
        <span className="dim-weight">{weight}</span>
      </div>
      <div className="dim-track">
        <div className="dim-fill" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="dim-value">{value}</span>
    </div>
  );
}

export default StatsPanel;
