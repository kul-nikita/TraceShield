'use strict';


const HIGH_RISK_DATA   = new Set(['password', 'creditCard', 'ssn']);
const MEDIUM_RISK_DATA = new Set(['email', 'phone', 'address', 'name', 'dateOfBirth']);

const TRACKING_COOKIE_PATTERNS = [
  /^_ga/, /^_gid/, /^_fbp/, /^_fbc/, /^__utm/, /^_hjid/, /^_hjSession/,
  /^mxp_/, /^amp_/, /^ajs_/, /^intercom/, /^hubspotutk/, /^OptanonConsent/,
  /^_pinterest/, /^_tt_/, /^criteo/, /^DoubleClick/i,
];

function calcPrivacyScore(record) {
  let score = 100;
  score -= Math.min((record.trackers || []).length * 5, 30);
  for (const dt of (record.sharedData || [])) {
    if (HIGH_RISK_DATA.has(dt))        score -= 15;
    else if (MEDIUM_RISK_DATA.has(dt)) score -= 5;
  }
  score -= Math.min((record.permissions || []).length * 10, 20);
  if (record.cookieData) score -= Math.min(record.cookieData.tracking * 3, 15);
  score -= Math.min((record.thirdPartyHosts || []).length, 10);
  return Math.max(0, Math.min(100, score));
}


function categorizeCookies(cookies) {
  let session = 0, persistent = 0, tracking = 0;
  for (const c of cookies) {
    if (!c.expirationDate) session++; else persistent++;
    if (TRACKING_COOKIE_PATTERNS.some(re => re.test(c.name))) tracking++;
  }
  return { total: cookies.length, session, persistent, tracking };
}


function getRootDomain(hostname) {
  const parts = hostname.split('.');
  return parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
}

function domainKey(hostname) { return `domain_${hostname}`; }

function emptyRecord(hostname, url) {
  return {
    domain: hostname, firstSeen: Date.now(), lastVisit: Date.now(),
    pageUrl: url, visits: 1, sharedData: [], trackers: [],
    permissions: [], privacyScore: 100, cookieData: undefined,
    thirdPartyHosts: [],
  };
}


async function getRecord(hostname) {
  const res = await chrome.storage.local.get(domainKey(hostname));
  return res[domainKey(hostname)] || null;
}

async function saveRecord(record) {
  await chrome.storage.local.set({ [domainKey(record.domain)]: record });
}

async function getGlobalStats() {
  const res = await chrome.storage.local.get('globalStats');
  return res.globalStats || {
    totalWebsites: 0, totalTrackers: 0, totalDataShared: 0,
    totalPermissionsRequested: 0, dataTypeCounts: {},
  };
}

async function saveGlobalStats(stats) {
  await chrome.storage.local.set({ globalStats: stats });
}

const tabHostnames = {};

async function getHostnameForTab(tabId) {
  if (tabHostnames[tabId]) return tabHostnames[tabId];
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.url) {
      const url = new URL(tab.url);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        tabHostnames[tabId] = url.hostname;
        return url.hostname;
      }
    }
  } catch (_) {}
  return null;
}

const tabAlertCounts = {};

async function incrementBadge(tabId) {
  tabAlertCounts[tabId] = (tabAlertCounts[tabId] || 0) + 1;
  try {
    await chrome.action.setBadgeText({ text: String(tabAlertCounts[tabId]), tabId });
    await chrome.action.setBadgeBackgroundColor({ color: '#fc8181', tabId });
  } catch (_) {}
}

function clearBadge(tabId) {
  tabAlertCounts[tabId] = 0;
  try { chrome.action.setBadgeText({ text: '', tabId }); } catch (_) {}
}


async function handleDataDetected(hostname, dataType, tabId) {
  let record = await getRecord(hostname);
  if (!record) return;

  if (!record.sharedData.includes(dataType)) {
    record.sharedData.push(dataType);
    record.privacyScore = calcPrivacyScore(record);
    await saveRecord(record);

    const stats = await getGlobalStats();
    stats.totalDataShared++;
    stats.dataTypeCounts[dataType] = (stats.dataTypeCounts[dataType] || 0) + 1;
    await saveGlobalStats(stats);

    if (HIGH_RISK_DATA.has(dataType) && tabId) await incrementBadge(tabId);
  }
}

async function handleTrackerDetected(hostname, trackerName, tabId) {
  let record = await getRecord(hostname);
  if (!record) return;

  if (!record.trackers.includes(trackerName)) {
    record.trackers.push(trackerName);
    record.privacyScore = calcPrivacyScore(record);
    await saveRecord(record);

    const stats = await getGlobalStats();
    stats.totalTrackers++;
    await saveGlobalStats(stats);

    if (tabId) await incrementBadge(tabId);
  }
}

async function handlePermissionRequested(hostname, permissionName, tabId) {
  let record = await getRecord(hostname);
  if (!record) return;

  if (!record.permissions.includes(permissionName)) {
    record.permissions.push(permissionName);
    record.privacyScore = calcPrivacyScore(record);
    await saveRecord(record);

    const stats = await getGlobalStats();
    stats.totalPermissionsRequested++;
    await saveGlobalStats(stats);

    if (tabId) await incrementBadge(tabId);
  }
}

async function handleGetAllData(sendResponse) {
  const all = await chrome.storage.local.get(null);
  const domains = [];
  let globalStats = null;

  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith('domain_')) domains.push(value);
    if (key === 'globalStats') globalStats = value;
  }

  sendResponse({
    domains,
    globalStats: globalStats || {
      totalWebsites: 0, totalTrackers: 0, totalDataShared: 0,
      totalPermissionsRequested: 0, dataTypeCounts: {},
    },
  });
}


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : null;

  if (msg.type === 'GET_ALL_DATA') {
    handleGetAllData(sendResponse);
    return true;
  }

  if (!tabId) return;

  getHostnameForTab(tabId).then(hostname => {
    if (!hostname) return;
    switch (msg.type) {
      case 'DATA_DETECTED':        handleDataDetected(hostname, msg.dataType, tabId);         break;
      case 'TRACKERS_DETECTED':    handleTrackerDetected(hostname, msg.trackerName, tabId);   break;
      case 'PERMISSION_REQUESTED': handlePermissionRequested(hostname, msg.permissionName, tabId); break;
    }
  });
});


chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  let url;
  try { url = new URL(details.url); } catch (_) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  const hostname = url.hostname;
  tabHostnames[details.tabId] = hostname;

  clearBadge(details.tabId);

  let record = await getRecord(hostname);
  const isNew = !record;

  if (!record) {
    record = emptyRecord(hostname, details.url);
  } else {
    record.lastVisit = Date.now();
    record.pageUrl   = details.url;
    record.visits++;
  }

  try {
    const cookies = await chrome.cookies.getAll({ domain: hostname });
    record.cookieData = categorizeCookies(cookies);
  } catch (_) {}

  record.privacyScore = calcPrivacyScore(record);
  await saveRecord(record);

  if (isNew) {
    const stats = await getGlobalStats();
    stats.totalWebsites++;
    await saveGlobalStats(stats);
  }
});


chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (!details.initiator) return;
    let initiatorHost, requestHost;
    try {
      initiatorHost = new URL(details.initiator).hostname;
      requestHost   = new URL(details.url).hostname;
    } catch (_) { return; }

    const initiatorRoot = getRootDomain(initiatorHost);
    const requestRoot   = getRootDomain(requestHost);
    if (initiatorRoot === requestRoot) return;

    const record = await getRecord(initiatorHost);
    if (!record) return;

    if (!record.thirdPartyHosts.includes(requestRoot) && record.thirdPartyHosts.length < 30) {
      record.thirdPartyHosts.push(requestRoot);
      record.privacyScore = calcPrivacyScore(record);
      await saveRecord(record);
    }
  },
  { urls: ['<all_urls>'], types: ['xmlhttprequest'] }
);


chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabHostnames[tabId];
  delete tabAlertCounts[tabId];
});
