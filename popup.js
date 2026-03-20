'use strict';

// these would rotate on every single new pop-up opening
const TIPS = [
  "Use a password manager — never reuse the same password across different sites.",
  "Enable two-factor authentication (2FA) on every account that supports it.",
  "Check for HTTPS (🔒) in the address bar before entering any personal information.",
  "Avoid public Wi-Fi for sensitive tasks — use a VPN if you must.",
  "Regularly audit which apps have access to your Google, Facebook, or Apple account.",
  "Clear your cookies and browser cache weekly to reduce long-term tracking.",
  "Be cautious of browser extensions — they can read everything on every page you visit.",
  "Use a privacy-focused browser like Firefox or Brave to reduce fingerprinting.",
  "Check haveibeenpwned.com periodically to see if your email has been in a data breach.",
  "Phishing emails often mimic real companies — always verify the sender's actual email domain.",
];

(function showTip() {
  // Use a counter stored in sessionStorage so it changes each popup open
  let idx = parseInt(sessionStorage.getItem('ts_tip_idx') || '-1', 10);
  idx = (idx + 1) % TIPS.length;
  sessionStorage.setItem('ts_tip_idx', String(idx));
  document.getElementById('tipText').textContent = TIPS[idx];
})();


//helpers

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function scoreClass(score) {
  if (score >= 70) return 'score-good';
  if (score >= 40) return 'score-medium';
  return 'score-poor';
}

function formatTime(ms) {
  if (!ms) return 'Unknown';
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
         ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}


function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  document.getElementById('btnTheme').textContent = theme === 'light' ? '🌙' : '☀️';
}

chrome.storage.local.get('theme', ({ theme }) => {
  applyTheme(theme || 'dark');
});

document.getElementById('btnTheme').addEventListener('click', () => {
  const isLight = document.body.classList.contains('light');
  const next = isLight ? 'dark' : 'light';
  applyTheme(next);
  chrome.storage.local.set({ theme: next });
});

function renderStats(stats) {
  document.getElementById('statSites').textContent    = stats.totalWebsites || 0;
  document.getElementById('statTrackers').textContent = stats.totalTrackers  || 0;
  document.getElementById('statData').textContent     = stats.totalDataShared || 0;
  document.getElementById('statPerms').textContent    = stats.totalPermissionsRequested || 0;
}

//for data type

function renderDataTypes(dataTypeCounts) {
  const container = document.getElementById('tagCloud');
  if (!dataTypeCounts || !Object.keys(dataTypeCounts).length) {
    container.innerHTML = '<span class="empty-state">No data detected yet — start browsing.</span>';
    return;
  }
  const sorted = Object.entries(dataTypeCounts).sort((a, b) => b[1] - a[1]);
  container.innerHTML = sorted.map(([type, count]) =>
    `<span class="data-tag">${esc(type)} <span class="tag-count">${esc(count)}</span></span>`
  ).join('');
}

//

function renderWebsites(domains) {
  const container = document.getElementById('siteList');
  if (!domains || !domains.length) {
    container.innerHTML = '<span class="empty-state">No sites recorded yet.</span>';
    return;
  }

  const sorted = [...domains].sort((a, b) => (b.lastVisit || 0) - (a.lastVisit || 0));

  container.innerHTML = sorted.map(d => {
    const sc           = d.privacyScore ?? 100;
    const cls          = scoreClass(sc);
    const trackerCount = (d.trackers || []).length;
    const dataCount    = (d.sharedData || []).length;
    const permCount    = (d.permissions || []).length;
    const thirdCount   = (d.thirdPartyHosts || []).length;
    const visits       = d.visits || 1;

    const trackerChips = (d.trackers || []).map(t =>
      `<span class="chip">${esc(t)}</span>`
    ).join('');

    const cookiePill = d.cookieData
      ? `<span class="pill">🍪 ${esc(d.cookieData.total)} cookies (${esc(d.cookieData.tracking)} tracking)</span>`
      : '';

    const thirdPill = thirdCount > 0
      ? `<span class="pill">🌐 ${esc(thirdCount)} third-party hosts</span>`
      : '';

    return `
      <div class="site-card" data-domain="${esc(d.domain)}">
        <div class="site-card-top">
          <span class="site-domain" title="${esc(d.domain)}">${esc(d.domain)}</span>
          <span class="score-badge ${cls}">${esc(sc)}/100</span>
        </div>
        <div class="pills">
          ${dataCount    ? `<span class="pill">📤 ${esc(dataCount)} data type${dataCount !== 1 ? 's' : ''}</span>` : ''}
          ${trackerCount ? `<span class="pill">🔍 ${esc(trackerCount)} tracker${trackerCount !== 1 ? 's' : ''}</span>` : ''}
          ${permCount    ? `<span class="pill">📍 ${esc(permCount)} permission${permCount !== 1 ? 's' : ''}</span>` : ''}
          ${cookiePill}
          ${thirdPill}
        </div>
        ${trackerChips ? `<div class="chip-list">${trackerChips}</div>` : ''}
        <div style="display:flex; justify-content:space-between; margin-top:4px;">
          <span class="site-time">Last visit: ${esc(formatTime(d.lastVisit))}</span>
          <span class="site-visits">👁 ${esc(visits)} visit${visits !== 1 ? 's' : ''}</span>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.site-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = `details.html?domain=${encodeURIComponent(card.dataset.domain)}`;
    });
  });
}

// exporting (works fine)

function exportData(domains, globalStats) {
  const report = {
    exportedAt: new Date().toISOString(),
    summary: globalStats,
    sites: domains,
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `traceshield-report-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

let _domains = [], _stats = {};

chrome.runtime.sendMessage({ type: 'GET_ALL_DATA' }, (response) => {
  if (!response) return;
  _domains = response.domains || [];
  _stats   = response.globalStats || {};
  renderStats(_stats);
  renderDataTypes(_stats.dataTypeCounts);
  renderWebsites(_domains);
});

document.getElementById('btnExport').addEventListener('click', () => {
  exportData(_domains, _stats);
});

document.getElementById('btnClear').addEventListener('click', () => {
  if (confirm('Clear all TraceShield data? This cannot be undone.')) {
    chrome.storage.local.clear(() => window.location.reload());
  }
});
