'use strict';

const HIGH_RISK_DATA   = new Set(['password', 'creditCard', 'ssn']);
const MEDIUM_RISK_DATA = new Set(['email', 'phone', 'address', 'name', 'dateOfBirth']);

const DATA_LABELS = {
  email:       'Email Address',
  phone:       'Phone Number',
  password:    'Password',
  creditCard:  'Credit Card',
  ssn:         'Social Security Number',
  dateOfBirth: 'Date of Birth',
  address:     'Home Address',
  name:        'Full Name',
};

const PERM_LABELS = {
  geolocation:           'Geolocation',
  camera:                'Camera',
  microphone:            'Microphone',
  notifications:         'Notifications',
  'clipboard-read':      'Clipboard Read',
  'clipboard-write':     'Clipboard Write',
  'persistent-storage':  'Persistent Storage',
};

//more helpers
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function scoreClass(score) {
  if (score >= 70) return 'score-good';
  if (score >= 40) return 'score-medium';
  return 'score-poor';
}

function formatTime(ms) {
  if (!ms) return 'Unknown';
  return new Date(ms).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function riskLevel(dataType) {
  if (HIGH_RISK_DATA.has(dataType))   return 'high';
  if (MEDIUM_RISK_DATA.has(dataType)) return 'medium';
  return 'low';
}


function buildDeductions(record) {
  const rows = [];

  const trackerCount = (record.trackers || []).length;
  const trackerDed   = Math.min(trackerCount * 5, 30);
  rows.push({
    label: `Trackers detected (${trackerCount} × 5, max 30)`,
    value: -trackerDed,
  });

  for (const dt of (record.sharedData || [])) {
    if (HIGH_RISK_DATA.has(dt)) {
      rows.push({ label: `High-risk data: ${DATA_LABELS[dt] || dt}`, value: -15 });
    } else if (MEDIUM_RISK_DATA.has(dt)) {
      rows.push({ label: `Medium-risk data: ${DATA_LABELS[dt] || dt}`, value: -5 });
    }
  }

  const permCount = (record.permissions || []).length;
  const permDed   = Math.min(permCount * 10, 20);
  rows.push({
    label: `Permissions requested (${permCount} × 10, max 20)`,
    value: -permDed,
  });

  if (record.cookieData) {
    const cookieDed = Math.min(record.cookieData.tracking * 3, 15);
    rows.push({
      label: `Tracking cookies (${record.cookieData.tracking} × 3, max 15)`,
      value: -cookieDed,
    });
  }

  const thirdCount = (record.thirdPartyHosts || []).length;
  const thirdDed   = Math.min(thirdCount, 10);
  rows.push({
    label: `Third-party hosts (${thirdCount}, max 10)`,
    value: -thirdDed,
  });

  return rows;
}


function renderHeader(record) {
  const sc = record.privacyScore ?? 100;
  document.getElementById('detailsDomain').textContent = record.domain;
  document.title = `TraceShield – ${record.domain}`;
  const badge = document.getElementById('detailsScore');
  badge.textContent = `${sc}/100`;
  badge.className   = `score-badge ${scoreClass(sc)}`;
}

function renderVisitSummary(record) {
  document.getElementById('firstSeen').textContent   = formatTime(record.firstSeen);
  document.getElementById('lastVisit').textContent   = formatTime(record.lastVisit);
  document.getElementById('totalVisits').textContent = record.visits ?? 1;
  document.getElementById('lastUrl').textContent     = record.pageUrl || '—';
}

function renderCookies(record) {
  if (!record.cookieData) return;
  document.getElementById('cookieSection').style.display = '';
  document.getElementById('cookieTotal').textContent    = record.cookieData.total;
  document.getElementById('cookieSession').textContent  = record.cookieData.session;
  document.getElementById('cookiePersist').textContent  = record.cookieData.persistent;
  document.getElementById('cookieTracking').textContent = record.cookieData.tracking;
}

function renderScoreBreakdown(record) {
  const sc = record.privacyScore ?? 100;
  const numEl = document.getElementById('scoreNumber');
  numEl.textContent = sc;
  numEl.className   = `score-number ${scoreClass(sc) === 'score-good' ? 'risk-low' : scoreClass(sc) === 'score-medium' ? 'risk-medium' : 'risk-high'}`;

  const deductions = buildDeductions(record);
  const list = document.getElementById('deductionList');

  list.innerHTML = `
    <div class="deduction-row">
      <span class="deduction-label">Starting score</span>
      <span class="deduction-value" style="color: var(--accent);">100</span>
    </div>
  `;

  for (const row of deductions) {
    const isZero = row.value === 0;
    list.innerHTML += `
      <div class="deduction-row">
        <span class="deduction-label">${esc(row.label)}</span>
        <span class="deduction-value ${isZero ? 'deduction-zero' : 'deduction-neg'}">${isZero ? '0' : esc(row.value)}</span>
      </div>`;
  }

  list.innerHTML += `
    <div class="deduction-row" style="border-color: var(--accent-dim);">
      <span class="deduction-label" style="font-weight:600; color: var(--text);">Final Score</span>
      <span class="deduction-value ${scoreClass(sc)}" style="font-size:14px;">${esc(sc)}</span>
    </div>`;
}

function renderSharedData(record) {
  const container = document.getElementById('sharedDataList');
  const data = record.sharedData || [];
  if (!data.length) { container.innerHTML = '<span class="empty-state">None detected.</span>'; return; }

  container.innerHTML = data.map(dt => {
    const lvl   = riskLevel(dt);
    const label = DATA_LABELS[dt] || dt;
    return `
      <div class="data-row">
        <span>${esc(label)}</span>
        <span class="risk-tag ${lvl}">${lvl}</span>
      </div>`;
  }).join('');
}

function renderTrackers(record) {
  const container = document.getElementById('trackerList');
  const trackers = record.trackers || [];
  if (!trackers.length) { container.innerHTML = '<span class="empty-state">None detected.</span>'; return; }
  container.innerHTML = trackers.map(t => `<span class="chip">${esc(t)}</span>`).join('');
}

function renderPermissions(record) {
  const container = document.getElementById('permissionList');
  const perms = record.permissions || [];
  if (!perms.length) { container.innerHTML = '<span class="empty-state">None detected.</span>'; return; }

  container.innerHTML = perms.map(p => {
    const label = PERM_LABELS[p] || p;
    return `
      <div class="data-row">
        <span>${esc(label)}</span>
        <span class="risk-tag high">Requested</span>
      </div>`;
  }).join('');
}

function renderThirdParty(record) {
  const container = document.getElementById('thirdPartyList');
  const hosts = record.thirdPartyHosts || [];
  if (!hosts.length) { container.innerHTML = '<span class="empty-state">None detected.</span>'; return; }
  container.innerHTML = hosts.map(h => `<span class="chip chip-third-party">${esc(h)}</span>`).join('');
}


const params = new URLSearchParams(window.location.search);
const domain = params.get('domain');

document.getElementById('btnBack').addEventListener('click', () => {
  window.location.href = 'popup.html';
});

if (!domain) {
  document.getElementById('detailsDomain').textContent = 'Unknown domain';
} else {
  chrome.storage.local.get(`domain_${domain}`, (result) => {
    const record = result[`domain_${domain}`];
    if (!record) {
      document.getElementById('detailsDomain').textContent = domain;
      return;
    }
    renderHeader(record);
    renderVisitSummary(record);
    renderCookies(record);
    renderScoreBreakdown(record);
    renderSharedData(record);
    renderTrackers(record);
    renderPermissions(record);
    renderThirdParty(record);
  });
}
